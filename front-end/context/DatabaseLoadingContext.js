import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BackHandler, Platform, View } from "react-native";
import { getApiActivitySnapshot, subscribeApiActivity } from "../utils/api";
import DatabaseLoadingOverlay from "../components/ui/DatabaseLoadingOverlay";

const LoadingContext = createContext({ busy: false, topModal: null, setReady: () => {}, register: () => () => {} });
export const ModalLayerContext = createContext(null);
export const useDatabaseLoading = () => useContext(LoadingContext);

export function BlockedContent({ busy, children }) {
    return <View style={{ flex: 1 }} pointerEvents={busy ? "none" : "auto"}
        accessibilityElementsHidden={busy} importantForAccessibility={busy ? "no-hide-descendants" : "auto"}
        aria-hidden={busy || undefined} {...(Platform.OS === "web" ? { inert: busy || undefined } : {})}>
        {children}
    </View>;
}

export function topModalLayer(layers) {
    const parents = new Map(layers.map((layer) => [layer.id, layer.parent]));
    const ancestor = (id, child) => {
        for (let parent = parents.get(child); parent != null; parent = parents.get(parent)) if (parent === id) return true;
        return false;
    };
    return layers.reduce((top, layer) => top && ancestor(layer.id, top) ? top : layer.id, null);
}

export default function DatabaseLoadingProvider({ children }) {
    const [ready, setReady] = useState(false);
    const readyRef = useRef(ready);
    readyRef.current = ready;
    const focusTarget = useRef(null);
    const wasActive = useRef(getApiActivitySnapshot());
    const subscribe = useCallback((notify) => subscribeApiActivity(() => {
        const active = getApiActivitySnapshot();
        // Capture before the DOM becomes inert and moves focus to the body.
        if (active && !wasActive.current && readyRef.current && Platform.OS === "web" && typeof document !== "undefined")
            focusTarget.current = document.activeElement;
        wasActive.current = active;
        notify();
    }), []);
    const activity = useSyncExternalStore(subscribe, getApiActivitySnapshot, () => false);
    const [layers, setLayers] = useState([]);
    const busy = ready && activity;
    const register = useCallback((id, parent) => {
        setLayers((current) => [...current.filter((layer) => layer.id !== id), { id, parent }]);
        return () => setLayers((current) => current.filter((layer) => layer.id !== id));
    }, []);
    const topModal = useMemo(() => topModalLayer(layers), [layers]);
    useEffect(() => {
        if (!busy) return undefined;
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
        return () => subscription.remove();
    }, [busy]);
    const value = useMemo(() => ({ busy, topModal, setReady, register, focusTarget }), [busy, topModal, register]);
    return <LoadingContext.Provider value={value}>
        <View style={{ flex: 1 }}>
            <BlockedContent busy={busy}>{children}</BlockedContent>
            {busy && topModal == null ? <DatabaseLoadingOverlay previousFocus={focusTarget} /> : null}
        </View>
    </LoadingContext.Provider>;
}
