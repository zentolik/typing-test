const settingsKey = "typespeed_settings";

function saveSettings() {
    const settings = {
        autoAdvance: document.getElementById("autoAdvance").checked,
        showTimeCursor: document.getElementById("showTimeCursor").checked,
        showWordsCursor: document.getElementById("showWordsCursor").checked,
        durationSelect: document.getElementById("durationSelect").value,
        durationCustom:
            document.getElementById("durationSelect").value === "custom"
                ? document.getElementById("customMinutes").value || "0"
                : false,
    };

    localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem(settingsKey);
    if (!saved) return;

    try {
        const settings = JSON.parse(saved);
        console.log('typespeed_settings:',settings);

        if (typeof settings.autoAdvance === "boolean") {
            document.getElementById("autoAdvance").checked = settings.autoAdvance;
        }

        if (typeof settings.showTimeCursor === "boolean") {
            document.getElementById("showTimeCursor").checked = settings.showTimeCursor;
        }
        if (typeof settings.showWordsCursor === "boolean") {
            document.getElementById("showWordsCursor").checked = settings.showWordsCursor;
        }

        if (settings.durationSelect) {
            document.getElementById("durationSelect").value = settings.durationSelect;

            if (settings.durationSelect === "custom") {
                document.getElementById("customMinutesWrapper").classList.remove("hidden");
                if (settings.durationCustom !== false && settings.durationCustom !== undefined) {
                    document.getElementById("customMinutes").value = settings.durationCustom;
                }
            } else {
                document.getElementById("customMinutesWrapper").classList.add("hidden");
            }
        }
    } catch (e) {
        console.warn("Konnte Settings nicht laden:", e);
    }
}

function attachSettingsListeners() {
    const els = [
        "autoAdvance",
        "showTimeCursor",
        "showWordsCursor",
        "durationSelect",
        "customMinutes",
    ];
    els.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", saveSettings);
        el.addEventListener("input", saveSettings);
    });

    document.getElementById("durationSelect").addEventListener("change", () => {
        if (document.getElementById("durationSelect").value === "custom") {
            document.getElementById("customMinutesWrapper").classList.remove("hidden");
        } else {
            document.getElementById("customMinutesWrapper").classList.add("hidden");
            document.getElementById("customMinutes").value = "";
        }
        saveSettings();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    attachSettingsListeners();
});