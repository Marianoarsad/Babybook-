import React from "react";
import GlassHeaderButton from "./ui/GlassHeaderButton";

// Polling lives once in App; the bell is only a navigation trigger.
export default function NotificationMenu({ count = 0, onOpen, blurTarget }) {
    return <GlassHeaderButton icon="notifications" blurTarget={blurTarget} badgeCount={count} onPress={onOpen}
        accessibilityLabel={`Notifications, ${count} unread`} />;
}
