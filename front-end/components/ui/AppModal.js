import React, { forwardRef, useContext, useLayoutEffect, useRef } from "react";
import { Modal, View } from "react-native";
import { BlockedContent, ModalLayerContext, useDatabaseLoading } from "../../context/DatabaseLoadingContext";
import DatabaseLoadingOverlay from "./DatabaseLoadingOverlay";

// Keep each native/web modal's own surface; do not present a competing modal.
export default forwardRef(function AppModal({ children, visible = true, onRequestClose, ...props }, ref) {
    const id = useRef(Symbol("modal")).current;
    const parent = useContext(ModalLayerContext);
    const { busy, topModal, register, focusTarget } = useDatabaseLoading();
    useLayoutEffect(() => visible ? register(id, parent) : undefined, [visible, id, parent, register]);
    return <Modal {...props} ref={ref} visible={visible} onRequestClose={(...args) => { if (!busy) onRequestClose?.(...args); }}>
        <ModalLayerContext.Provider value={id}>
            <View style={{ flex: 1 }}>
                <BlockedContent busy={busy}>{children}</BlockedContent>
                {busy && topModal === id ? <DatabaseLoadingOverlay previousFocus={focusTarget} /> : null}
            </View>
        </ModalLayerContext.Provider>
    </Modal>;
});
