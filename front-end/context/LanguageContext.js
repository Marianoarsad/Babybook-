import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations } from "../translations";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguageState] = useState("en");

    useEffect(() => {
        const loadSavedLanguage = async () => {
            try {
                const saved = await AsyncStorage.getItem("bb_language");
                if (saved === "en" || saved === "fil" || saved === "tag") {
                    setLanguageState(saved);
                }
            } catch (e) {
                console.log("Error loading saved language:", e);
            }
        };
        loadSavedLanguage();
    }, []);

    const setLanguage = async (lang) => {
        try {
            setLanguageState(lang);
            await AsyncStorage.setItem("bb_language", lang);
        } catch (e) {
            console.log("Error saving language:", e);
        }
    };

    const t = (key) => {
        const dictionary = translations[language];
        if (!dictionary) {
            return translations["en"][key] || "";
        }
        return dictionary[key] || translations["en"][key] || "";
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
};
