import { closeSlot, openSlot, type SidebarLayout, type SidebarSlotId } from "./sidebar-layout.ts";

export function createChatPaneSlotCallbacks(params: {
  currentLayout: () => SidebarLayout;
  layout: SidebarLayout;
  setObserverVisible: (visible: boolean) => void;
  updateLayout: (layout: SidebarLayout) => void;
}) {
  const has = (slot: SidebarSlotId) =>
    params.layout.columns[0]?.panels.some((panel) => panel.slot === slot) === true;
  const open = (slot: SidebarSlotId) => {
    params.updateLayout(openSlot(params.currentLayout(), slot));
    if (slot === "companion") {
      params.setObserverVisible(true);
    }
  };
  const close = (slot: SidebarSlotId) => {
    if (slot === "companion") {
      params.setObserverVisible(false);
    }
    params.updateLayout(closeSlot(params.currentLayout(), slot));
  };
  return {
    close,
    has,
    open,
    toggle: (slot: SidebarSlotId) => (has(slot) ? close(slot) : open(slot)),
  };
}
