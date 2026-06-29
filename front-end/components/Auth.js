import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";

export default function Auth({ onLoginSuccess }) {
    const { language, t } = useLanguage();
    const [authScene, setAuthScene] = useState("login");

    // Login credentials
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    // Register state
    const [regName, setRegName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPass, setRegPass] = useState("");
    const [regConfirm, setRegConfirm] = useState("");
    const [regGender, setRegGender] = useState("Female");
    const [termsAgreed, setTermsAgreed] = useState(false);

    // Forgot state
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotSent, setForgotSent] = useState(false);

    const handleLoginSubmit = () => {
        if (!email || !password) {
            alert("Please fill out all fields");
            return;
        }
        setLoginLoading(true);
        setTimeout(() => {
            setLoginLoading(false);
            onLoginSuccess(
                email.split("@")[0] || "Sarah",
                regGender || "Female",
            );
        }, 1200);
    };

    const handleRegisterSubmit = () => {
        if (!regName || !regEmail || !regPass || !regConfirm) {
            alert("Please fill out all fields");
            return;
        }
        if (regPass !== regConfirm) {
            alert("Passwords do not match. Please verify.");
            return;
        }
        if (!termsAgreed) {
            alert("You must accept the Terms of Service to create an account.");
            return;
        }
        setLoginLoading(true);
        setTimeout(() => {
            setLoginLoading(false);
            onLoginSuccess(regName || "New Parent", regGender);
        }, 1200);
    };

    const handleForgotSubmit = () => {
        if (!forgotEmail) {
            alert("Please enter your email");
            return;
        }
        setLoginLoading(true);
        setTimeout(() => {
            setLoginLoading(false);
            setForgotSent(true);
        }, 1200);
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons
                            name="book-outline"
                            size={28}
                            color="#456155"
                        />
                    </View>
                    <Text style={styles.title}>{t("authWelcome")}</Text>
                    <Text style={styles.subtitle}>{t("authSub")}</Text>
                </View>

                {authScene === "login" && (
                    <View style={styles.form}>
                        <View
                            style={{ marginBottom: 12, alignItems: "center" }}
                        >
                            <Text style={styles.formTitle}>
                                {language === "en"
                                    ? "Welcome Back"
                                    : language === "fil"
                                      ? "Maligayang Pagbabalik"
                                      : "Welcome Back, Parent!"}
                            </Text>
                            <Text style={styles.formSub}>
                                {language === "en"
                                    ? "Log baby's developmental milestones daily."
                                    : language === "fil"
                                      ? "I-log ang bawat developmental milestones ni baby araw-araw."
                                      : "I-log natin ang milestones ni baby everyday."}
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons
                                    name="mail-outline"
                                    size={16}
                                    color="#78716C"
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder={
                                        language === "en"
                                            ? "Enter email address"
                                            : "Ilagay ang email"
                                    }
                                    placeholderTextColor="#A8A29E"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 4,
                                }}
                            >
                                <Text style={styles.label}>Password</Text>
                                <TouchableOpacity
                                    onPress={() => setAuthScene("forgot")}
                                >
                                    <Text style={styles.forgotText}>
                                        {language === "en"
                                            ? "Forgot Password?"
                                            : "Nakalimutan ang Password?"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputWrapper}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={16}
                                    color="#78716C"
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder={
                                        language === "en"
                                            ? "Enter your password"
                                            : "Ilagay ang password"
                                    }
                                    placeholderTextColor="#A8A29E"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleLoginSubmit}
                            disabled={loginLoading}
                        >
                            {loginLoading ? (
                                <ActivityIndicator
                                    color="#FFFFFF"
                                    size="small"
                                />
                            ) : (
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                    }}
                                >
                                    <Text style={styles.buttonText}>
                                        {language === "en"
                                            ? "Enter App"
                                            : "Pumasok sa App"}
                                    </Text>
                                    <Ionicons
                                        name="arrow-forward"
                                        size={16}
                                        color="#FFFFFF"
                                        style={{ marginLeft: 6 }}
                                    />
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                {language === "en"
                                    ? "Don't have an account?"
                                    : "Wala pang account?"}{" "}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setAuthScene("register")}
                            >
                                <Text style={styles.footerLink}>
                                    {language === "en"
                                        ? "Sign up here"
                                        : "Mag-sign up dito"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {authScene === "register" && (
                    <View style={styles.form}>
                        <View
                            style={{ marginBottom: 12, alignItems: "center" }}
                        >
                            <Text style={styles.formTitle}>
                                {language === "en"
                                    ? "Create an Account"
                                    : "Gumawa ng Account"}
                            </Text>
                            <Text style={styles.formSub}>
                                {language === "en"
                                    ? "Join our community to keep track of your baby."
                                    : "Sumali sa aming komunidad para masubaybayan si baby."}
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                {language === "en"
                                    ? "Parent's Full Name"
                                    : "Pangalan ng Magulang"}
                            </Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons
                                    name="person-outline"
                                    size={16}
                                    color="#78716C"
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter full name"
                                    placeholderTextColor="#A8A29E"
                                    value={regName}
                                    onChangeText={setRegName}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons
                                    name="mail-outline"
                                    size={16}
                                    color="#78716C"
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter email address"
                                    placeholderTextColor="#A8A29E"
                                    value={regEmail}
                                    onChangeText={setRegEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View
                                style={[
                                    styles.inputGroup,
                                    { flex: 1, marginRight: 6 },
                                ]}
                            >
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    style={[
                                        styles.inputStandard,
                                        { height: 40 },
                                    ]}
                                    placeholder="••••••••"
                                    placeholderTextColor="#A8A29E"
                                    secureTextEntry
                                    value={regPass}
                                    onChangeText={setRegPass}
                                />
                            </View>
                            <View
                                style={[
                                    styles.inputGroup,
                                    { flex: 1, marginLeft: 6 },
                                ]}
                            >
                                <Text style={styles.label}>Confirm Choice</Text>
                                <TextInput
                                    style={[
                                        styles.inputStandard,
                                        { height: 40 },
                                    ]}
                                    placeholder="••••••••"
                                    placeholderTextColor="#A8A29E"
                                    secureTextEntry
                                    value={regConfirm}
                                    onChangeText={setRegConfirm}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Parent Gender</Text>
                            <View style={styles.genderContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        regGender === "Female" &&
                                            styles.genderButtonActive,
                                    ]}
                                    onPress={() => setRegGender("Female")}
                                >
                                    <Text
                                        style={[
                                            styles.genderButtonText,
                                            regGender === "Female" &&
                                                styles.genderButtonTextActive,
                                        ]}
                                    >
                                        {language === "en"
                                            ? "Female (Mama)"
                                            : "Babae (Mama)"}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        regGender === "Male" &&
                                            styles.genderButtonActive,
                                    ]}
                                    onPress={() => setRegGender("Male")}
                                >
                                    <Text
                                        style={[
                                            styles.genderButtonText,
                                            regGender === "Male" &&
                                                styles.genderButtonTextActive,
                                        ]}
                                    >
                                        {language === "en"
                                            ? "Male (Papa)"
                                            : "Lalaki (Papa)"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setTermsAgreed(!termsAgreed)}
                        >
                            <View
                                style={[
                                    styles.checkbox,
                                    termsAgreed && styles.checkboxChecked,
                                ]}
                            >
                                {termsAgreed && (
                                    <Ionicons
                                        name="checkmark"
                                        size={12}
                                        color="#FFFFFF"
                                    />
                                )}
                            </View>
                            <Text style={styles.checkboxLabel}>
                                {language === "en"
                                    ? "I agree to Terms & Guidelines"
                                    : "Sumasang-ayon ako sa Mga Tuntunin"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleRegisterSubmit}
                            disabled={loginLoading}
                        >
                            {loginLoading ? (
                                <ActivityIndicator
                                    color="#FFFFFF"
                                    size="small"
                                />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {language === "en"
                                        ? "Register Account"
                                        : "I-rehistro ang Account"}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                {language === "en"
                                    ? "Already have an account?"
                                    : "May account ka na ba?"}{" "}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setAuthScene("login")}
                            >
                                <Text style={styles.footerLink}>
                                    {language === "en"
                                        ? "Log in here"
                                        : "Mag-log in dito"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {authScene === "forgot" && (
                    <View style={styles.form}>
                        <View
                            style={{ marginBottom: 12, alignItems: "center" }}
                        >
                            <Text style={styles.formTitle}>
                                {language === "en"
                                    ? "Recover Password"
                                    : "I-recover ang Password"}
                            </Text>
                            <Text style={styles.formSub}>
                                {language === "en"
                                    ? "Enter email to receive recovery instructions."
                                    : "Ilagay ang iyong email para makuha muli ang password."}
                            </Text>
                        </View>

                        {forgotSent ? (
                            <View style={styles.forgotSuccess}>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={40}
                                    color="#456155"
                                />
                                <Text style={styles.forgotSuccessTitle}>
                                    {language === "en"
                                        ? "Reset Email Sent!"
                                        : "Naipadala na ang email!"}
                                </Text>
                                <Text style={styles.forgotSuccessText}>
                                    {language === "en"
                                        ? "Check your inbox for further directions."
                                        : "Tingnan ang inyong inbox para sa karagdagang tagubilin."}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.button, { marginTop: 16 }]}
                                    onPress={() => {
                                        setForgotSent(false);
                                        setAuthScene("login");
                                    }}
                                >
                                    <Text style={styles.buttonText}>
                                        {language === "en"
                                            ? "Back to Log In"
                                            : "Bumalik sa Log In"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                        Email Address
                                    </Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons
                                            name="mail-outline"
                                            size={16}
                                            color="#78716C"
                                            style={styles.inputIcon}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter email address"
                                            placeholderTextColor="#A8A29E"
                                            value={forgotEmail}
                                            onChangeText={setForgotEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.button}
                                    onPress={handleForgotSubmit}
                                    disabled={loginLoading}
                                >
                                    {loginLoading ? (
                                        <ActivityIndicator
                                            color="#FFFFFF"
                                            size="small"
                                        />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            {language === "en"
                                                ? "Send Reset Link"
                                                : "Ipadala ang Reset Link"}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{
                                        marginTop: 12,
                                        alignItems: "center",
                                    }}
                                    onPress={() => setAuthScene("login")}
                                >
                                    <Text style={styles.forgotText}>
                                        {language === "en"
                                            ? "Cancel"
                                            : "Kanselahin"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFDF9",
        paddingVertical: 24,
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 32,
        borderWidth: 1,
        borderColor: "#EBEBEB",
        padding: 24,
        width: "100%",
        maxWidth: 400,
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 4,
    },
    header: {
        alignItems: "center",
        marginBottom: 24,
    },
    logoContainer: {
        width: 56,
        height: 56,
        backgroundColor: "#E8F5E9",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#C8E6C9",
    },
    title: {
        fontSize: 22,
        fontWeight: "800",
        color: "#456155",
        textAlign: "center",
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 12,
        color: "#78716C",
        textAlign: "center",
        marginTop: 4,
    },
    form: {
        width: "100%",
    },
    formTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1C1917",
        textAlign: "center",
    },
    formSub: {
        fontSize: 11,
        color: "#78716C",
        textAlign: "center",
        marginTop: 2,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 10,
        fontWeight: "700",
        color: "#A8A29E",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 13,
        color: "#1C1917",
    },
    inputStandard: {
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 13,
        color: "#1C1917",
    },
    forgotText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#FF8A7A",
    },
    row: {
        flexDirection: "row",
    },
    button: {
        height: 44,
        backgroundColor: "#FF8A7A",
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
        shadowColor: "#FF8A7A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 3,
    },
    buttonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 16,
    },
    footerText: {
        color: "#78716C",
        fontSize: 12,
    },
    footerLink: {
        color: "#456155",
        fontWeight: "750",
        fontSize: 12,
    },
    genderContainer: {
        flexDirection: "row",
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        padding: 4,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
    },
    genderButtonActive: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    genderButtonText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#78716C",
    },
    genderButtonTextActive: {
        color: "#456155",
        fontWeight: "700",
    },
    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        marginTop: 4,
    },
    checkbox: {
        width: 16,
        height: 16,
        borderWidth: 1,
        borderColor: "#D6D3D1",
        borderRadius: 4,
        marginRight: 8,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    checkboxChecked: {
        backgroundColor: "#456155",
        borderColor: "#456155",
    },
    checkboxLabel: {
        fontSize: 11,
        color: "#57534E",
        fontWeight: "500",
    },
    forgotSuccess: {
        alignItems: "center",
        paddingVertical: 16,
    },
    forgotSuccessTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#456155",
        marginTop: 12,
    },
    forgotSuccessText: {
        fontSize: 12,
        color: "#78716C",
        textAlign: "center",
        marginTop: 4,
        lineHeight: 16,
    },
});
