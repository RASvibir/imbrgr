# GPU video endpoint contract

Set `VIDEO_PROVIDER=gpu`, `VIDEO_GPU_ENDPOINT` and optionally `VIDEO_GPU_TOKEN`, `VIDEO_GPU_MAX_CLIP_SEC` (default 5) and `VIDEO_GPU_TIMEOUT_SEC` (default 300).

`POST {endpoint}/generate` with JSON `{ prompt, durationSec, width, height, seed, initImage? }`. `initImage` is a data URL of the previous clip's last frame; start the clip from it. Respond `{ "id": "<job id>" }` immediately.

`GET {endpoint}/status/{id}` responds `{ "status": "queued" | "running" | "done" | "failed", "videoUrl"?, "lastFrameUrl"?, "error"? }`. Unknown ids return 404.

On `done`, `videoUrl` is an MP4 and `lastFrameUrl` is the final frame as JPEG or PNG. Both must be on the same origin as the endpoint. imbrgr copies them into its own storage and never hotlinks the GPU host.

When `VIDEO_GPU_TOKEN` is set, every request carries `Authorization: Bearer <token>`.

Mature jobs never use this backend.
