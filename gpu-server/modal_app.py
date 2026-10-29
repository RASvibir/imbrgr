"""
imbrgr GPU video server on Modal. Implements docs/video-gpu-endpoint.md.

Model: LTX-Video via diffusers (text-to-video, and image-to-video when the
previous clip's last frame is passed as initImage).

Deploy (one time):
    pip install modal && modal setup
    modal secret create imbrgr-video-token VIDEO_GPU_TOKEN=<long random string>
    modal deploy gpu-server/modal_app.py

Then set in Vercel (production):
    VIDEO_PROVIDER=gpu
    VIDEO_GPU_ENDPOINT=https://<workspace>--imbrgr-video-web.modal.run
    VIDEO_GPU_TOKEN=<same string as the Modal secret>

Cost guards: max 2 GPU containers, 60 s idle scale-down, clips capped at
MAX_SEC seconds and MAX_SIDE pixels. Also set a spend limit in the Modal
dashboard.
"""
import base64
import hmac
import io
import os
import re
import uuid

import modal

APP_NAME = "imbrgr-video"
MODEL_ID = "Lightricks/LTX-Video"
FPS = 24
MAX_SEC = 6
MAX_SIDE = 768
STEPS = 40
OUT = "/out"
NEGATIVE = "worst quality, inconsistent motion, blurry, jittery, distorted, watermark, text"

app = modal.App(APP_NAME)
jobs = modal.Dict.from_name(f"{APP_NAME}-jobs", create_if_missing=True)
out_vol = modal.Volume.from_name(f"{APP_NAME}-out", create_if_missing=True)
token_secret = modal.Secret.from_name("imbrgr-video-token")


def _bake_weights():
    import torch
    from diffusers import LTXPipeline

    LTXPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)


gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "diffusers>=0.32.0",
        "transformers",
        "accelerate",
        "sentencepiece",
        "protobuf",
        "ftfy",
        "imageio",
        "imageio-ffmpeg",
        "pillow",
    )
    .run_function(_bake_weights)
)
web_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]")


def _dims(w, h):
    w = int(w or 704)
    h = int(h or 480)
    scale = min(1.0, MAX_SIDE / max(w, h))
    w = max(256, int(w * scale) // 32 * 32)
    h = max(256, int(h * scale) // 32 * 32)
    return w, h


def _frames(sec):
    n = int(round(float(sec or 4) * FPS))
    n = max(9, min(n, MAX_SEC * FPS))
    return (n - 1) // 8 * 8 + 1  # LTX needs 8k+1 frames


def _decode_data_url(s):
    from PIL import Image

    raw = s.split(",", 1)[1] if s.startswith("data:") else s
    return Image.open(io.BytesIO(base64.b64decode(raw)))


@app.cls(
    gpu="L40S",
    image=gpu_image,
    volumes={OUT: out_vol},
    timeout=15 * 60,
    scaledown_window=60,
    max_containers=2,
)
class Generator:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import LTXImageToVideoPipeline, LTXPipeline

        self.t2v = LTXPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16).to("cuda")
        self.i2v = LTXImageToVideoPipeline(**self.t2v.components)

    @modal.method()
    def run(self, job_id: str, req: dict):
        import torch
        from diffusers.utils import export_to_video

        jobs[job_id] = {"status": "running"}
        try:
            w, h = _dims(req.get("width"), req.get("height"))
            kwargs = dict(
                prompt=str(req["prompt"])[:1000],
                negative_prompt=NEGATIVE,
                width=w,
                height=h,
                num_frames=_frames(req.get("durationSec")),
                num_inference_steps=STEPS,
                generator=torch.Generator(device="cuda").manual_seed(int(req.get("seed") or 0) % (2**31)),
            )
            init = req.get("initImage")
            if init:
                image = _decode_data_url(init).convert("RGB").resize((w, h))
                result = self.i2v(image=image, **kwargs)
            else:
                result = self.t2v(**kwargs)
            frames = result.frames[0]
            os.makedirs(OUT, exist_ok=True)
            export_to_video(frames, f"{OUT}/{job_id}.mp4", fps=FPS)
            frames[-1].save(f"{OUT}/{job_id}.jpg", quality=92)
            out_vol.commit()
            jobs[job_id] = {"status": "done"}
        except Exception as e:  # report to the caller instead of retrying
            jobs[job_id] = {"status": "failed", "error": str(e)[:300]}


@app.function(image=web_image, secrets=[token_secret], volumes={OUT: out_vol})
@modal.asgi_app()
def web():
    from fastapi import FastAPI, Header, HTTPException, Request
    from fastapi.responses import FileResponse

    api = FastAPI()
    expected = os.environ.get("VIDEO_GPU_TOKEN", "")

    def check(auth):
        # Fails closed: a public endpoint that spends money always needs the token.
        if not expected:
            raise HTTPException(500, "server token not configured")
        if not hmac.compare_digest(auth or "", f"Bearer {expected}"):
            raise HTTPException(401, "unauthorized")

    @api.post("/generate")
    async def generate(request: Request, authorization: str = Header(None)):
        check(authorization)
        body = await request.json()
        prompt = body.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise HTTPException(400, "prompt required")
        init = body.get("initImage")
        if init is not None and (not isinstance(init, str) or len(init) > 12_000_000):
            raise HTTPException(400, "initImage invalid or too large")
        job_id = uuid.uuid4().hex
        jobs[job_id] = {"status": "queued"}
        Generator().run.spawn(job_id, body)
        return {"id": job_id}

    @api.get("/status/{job_id}")
    async def status(job_id: str, request: Request, authorization: str = Header(None)):
        check(authorization)
        if not re.fullmatch(r"[0-9a-f]{32}", job_id):
            raise HTTPException(404, "unknown job")
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "unknown job")
        out = dict(job)
        if out.get("status") == "done":
            origin = f"https://{request.headers['host']}"  # must match the endpoint's origin
            out["videoUrl"] = f"{origin}/files/{job_id}.mp4"
            out["lastFrameUrl"] = f"{origin}/files/{job_id}.jpg"
        return out

    @api.get("/files/{name}")
    async def files(name: str, authorization: str = Header(None)):
        check(authorization)
        if not re.fullmatch(r"[0-9a-f]{32}\.(mp4|jpg)", name):
            raise HTTPException(404, "not found")
        out_vol.reload()
        path = f"{OUT}/{name}"
        if not os.path.exists(path):
            raise HTTPException(404, "not found")
        return FileResponse(path, media_type="video/mp4" if name.endswith(".mp4") else "image/jpeg")

    return api
