function canDeleteRecord(record, onDelete) {
    return record?.id != null && typeof onDelete === "function";
}

async function deleteRecordAndClose(onDelete, onClose, isCurrent = () => true) {
    const deleted = await onDelete();
    if (deleted === true && isCurrent()) onClose();
    return deleted === true;
}

function headerActionIcon(label, action, translatedLabel) {
    const value = label.trim().toLowerCase();
    if (value !== action && value !== translatedLabel.trim().toLowerCase()) return null;
    return action === "cancel" ? "close" : "checkmark";
}

module.exports = { canDeleteRecord, deleteRecordAndClose, headerActionIcon };
