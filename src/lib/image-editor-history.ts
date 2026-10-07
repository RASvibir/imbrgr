import type { ImageEditState } from "@/lib/image-editor-render";
import { DEFAULT_IMAGE_EDIT_STATE } from "@/lib/image-editor-render";

export type EditorHistoryEntry = {
  edit: ImageEditState;
  drawDataUrl: string | null;
};

export function cloneEditState(s: ImageEditState): ImageEditState {
  return { ...s, spotFixes: [...s.spotFixes] };
}

export function initialEditorHistory(): EditorHistoryEntry[] {
  return [{ edit: cloneEditState(DEFAULT_IMAGE_EDIT_STATE), drawDataUrl: null }];
}
