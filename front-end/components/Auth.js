import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../utils/api";
import { space, radius, shadow, type, MIN_TOUCH } from "../theme";
import { useTheme } from "../context/ThemeContext";
import Field from "./ui/Field";
import Button from "./ui/Button";
import { RELATIONSHIPS } from "../utils/relationship";
import { useToast } from "./ui/Toast";
import KeyboardAvoider from "./ui/KeyboardAvoider";

// Deliberately permissive: enough to catch "mariaexample.com" and
// "maria@example" before a round trip, without rejecting a valid address this
// regex has not heard of. The server's isEmail() is still the authority.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Auth({ onLoginSuccess, onProfessional, onBack, initialScene = "login" }) {
    const { language } = useLanguage();
    const { colors } = useTheme();
    const toast = useToast();
    const [scene, setScene] = useState(initialScene);
    const [loading, setLoading] = useState(false);

    // login
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // register
    const [regName, setRegName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPass, setRegPass] = useState("");
    const [regConfirm, setRegConfirm] = useState("");
    // Who the account holder is to the child. This replaced a Female/Male
    // toggle that wrote users.gender -- see utils/relationship.js for why.
    // Starts empty on purpose: a pre-selected "Mother" would be recorded as an
    // answer for every parent who never looked at the row.
    const [regRelationship, setRegRelationship] = useState("");
    // Optional. users.phone_number has existed since the first schema and the
    // register endpoint has always accepted it, but this form never sent one,
    // so every account the app has ever created reads "No phone on file".
    const [regPhone, setRegPhone] = useState("");
    const [regCity, setRegCity] = useState("");
    const [termsAgreed, setTermsAgreed] = useState(false);
    // forgot
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotSent, setForgotSent] = useState(false);
    // inline errors
    const [errors, setErrors] = useState({});

    const setErr = (k, v) => setErrors((e) => ({ ...e, [k]: v }));

    const handleLogin = async () => {
        const e = {};
        if (!email.trim()) e.email = "Email is required";
        if (!password) e.password = "Password is required";
        setErrors(e);
        if (Object.keys(e).length) return;
        setLoading(true);
        try {
            const { user, token } = await api.login({ email: email.trim(), password });
            // Awaited: onLoginSuccess now fetches the children before it hands
            // over, and without the await this button would stop spinning while
            // the sign-in screen sat there apparently doing nothing.
            await onLoginSuccess(user, token);
        } catch (err) {
            toast.error(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        const e = {};
        if (!regName.trim()) e.regName = "Your name is required";
        if (!regEmail.trim()) e.regEmail = "Email is required";
        // Shape-checked here, not just on the server. This address is the only
        // route back into the account if the password is forgotten, and a typo
        // was previously caught only after a round trip, as a red toast with no
        // field attached to it.
        else if (!EMAIL_RE.test(regEmail.trim())) e.regEmail = "That doesn't look like an email address";
        if (regPass.length < 8) e.regPass = "At least 8 characters";
        if (regConfirm !== regPass) e.regConfirm = "Passwords don't match";
        if (!regRelationship) e.regRelationship = "Please choose one";
        // Inline, like every other field on this form. It used to be a toast,
        // which appears away from the control it is about and then leaves.
        if (!termsAgreed) e.terms = "Please accept the agreement to continue";
        setErrors(e);
        if (Object.keys(e).length) return;
        setLoading(true);
        try {
            const { user, token } = await api.register({
                fullName: regName.trim(),
                email: regEmail.trim(),
                password: regPass,
                relationship: regRelationship,
                // Sent only when filled: a skipped optional box must store NULL
                // ("Not recorded"), never an empty string that looks answered.
                phoneNumber: regPhone.trim() || undefined,
                city: regCity.trim() || undefined,
                consentAccepted: true,
            });
            await onLoginSuccess(user, token);
        } catch (err) {
            toast.error(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    const handleForgot = async () => {
        if (!forgotEmail.trim()) {
            setErr("forgotEmail", "Email is required");
            return;
        }
        setLoading(true);
        try {
            await api.forgotPassword({ email: forgotEmail.trim() });
            setForgotSent(true);
        } catch (err) {
            toast.error(err.message || "Could not send reset email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoider>
        <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.lg }}
            style={{ backgroundColor: colors.background }}
        >
            <View
                style={[
                    {
                        backgroundColor: colors.surface,
                        borderRadius: radius.xl,
                        borderCurve: "continuous",
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: space.xl,
                        width: "100%",
                        maxWidth: 440,
                        alignSelf: "center",
                    },
                    shadow.card,
                ]}
            >
                {/* Back to the landing page — only from the entry scenes; the
                    "forgot" scene has its own back-to-login link. */}
                {onBack && (scene === "login" || scene === "register") ? (
                    <TouchableOpacity
                        onPress={onBack}
                        accessibilityRole="button"
                        accessibilityLabel="Back to landing page"
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: space.xs,
                            alignSelf: "flex-start",
                            minHeight: MIN_TOUCH,
                            paddingRight: space.md,
                            marginBottom: space.xs,
                        }}
                    >
                        <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textSecondary }}>
                            Back
                        </Text>
                    </TouchableOpacity>
                ) : null}

                {/* Brand header */}
                <View style={{ alignItems: "center", marginBottom: space.xl }}>
                    {/* The real brand mark (assets/splash-icon.png), the same
                        one the splash and the launcher icon use. This was a
                        generic Ionicons "book-outline" in a tinted box, so the
                        app showed one logo on launch and a different one at
                        sign-in. No tinted container: the artwork already carries
                        its own padding, and the splash presents it on a plain
                        ground. */}
                    <Image
                        source={require("../assets/splash-icon.png")}
                        style={{ width: 64, height: 64, marginBottom: space.sm }}
                        resizeMode="contain"
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel="BabyBook+"
                    />
                    <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>BabyBook+</Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: space.xs }}>
                        Your child's health, all in one place
                    </Text>
                </View>

                {scene === "login" && (
                    <View style={{ gap: space.xs }}>
                        <Field
                            label="Email Address"
                            placeholder="Enter your email"
                            value={email}
                            onChangeText={(t) => {
                                setEmail(t);
                                if (errors.email) setErr("email", "");
                            }}
                            error={errors.email}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            textContentType="username"
                        />
                        <Field
                            label="Password"
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={(t) => {
                                setPassword(t);
                                if (errors.password) setErr("password", "");
                            }}
                            error={errors.password}
                            secureTextEntry
                            autoComplete="current-password"
                            textContentType="password"
                        />
                        <TouchableOpacity
                            onPress={() => setScene("forgot")}
                            accessibilityRole="button"
                            style={{ alignSelf: "flex-end", paddingVertical: space.xs, marginBottom: space.sm }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accentStrong }}>
                                Forgot password?
                            </Text>
                        </TouchableOpacity>

                        <Button title="Log In" icon="arrow-forward" onPress={handleLogin} loading={loading} />

                        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: space.lg }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => setScene("register")} accessibilityRole="button">
                                <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>Sign up</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", marginVertical: space.lg }}>
                            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                            <Text style={{ marginHorizontal: space.md, fontSize: 13, fontWeight: "800", color: colors.textMuted }}>OR</Text>
                            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                        </View>

                        <Button
                            title="Healthcare Professional Access"
                            variant="secondary"
                            icon="medkit-outline"
                            onPress={() => onProfessional && onProfessional()}
                        />
                    </View>
                )}

                {scene === "register" && (
                    <View style={{ gap: space.xs }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: space.sm }}>
                            {language === "en" ? "Create an Account" : "Gumawa ng Account"}
                        </Text>
                        <Field
                            label="Your Full Name"
                            placeholder="Enter full name"
                            value={regName}
                            onChangeText={(t) => { setRegName(t); if (errors.regName) setErr("regName", ""); }}
                            error={errors.regName}
                            autoComplete="name"
                            textContentType="name"
                        />
                        <Field
                            label="Email Address"
                            placeholder="Enter email"
                            value={regEmail}
                            onChangeText={(t) => { setRegEmail(t); if (errors.regEmail) setErr("regEmail", ""); }}
                            error={errors.regEmail}
                            helper="This is how you sign in, and the only way to reset a forgotten password."
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            textContentType="username"
                        />
                        {/* Stacked, not side by side. Each secure field now
                            carries a reveal control, and two of them sharing one
                            row leaves about 90pt of text at phone width. */}
                        <Field
                            label="Password"
                            placeholder="••••••••"
                            secureTextEntry
                            value={regPass}
                            onChangeText={(t) => { setRegPass(t); if (errors.regPass) setErr("regPass", ""); }}
                            error={errors.regPass}
                            helper="At least 8 characters."
                            autoComplete="new-password"
                            textContentType="newPassword"
                        />
                        <Field
                            label="Confirm Password"
                            placeholder="••••••••"
                            secureTextEntry
                            value={regConfirm}
                            onChangeText={(t) => { setRegConfirm(t); if (errors.regConfirm) setErr("regConfirm", ""); }}
                            error={errors.regConfirm}
                            autoComplete="new-password"
                            textContentType="newPassword"
                        />

                        {/* Relationship to the child. This was a two-option
                            Female/Male toggle writing users.gender, on a form
                            whose own app calls this person the Primary Guardian
                            — so a lola or a tita holding the record had to pick
                            a gender to stand in for a relationship. Five chips
                            that wrap, rather than a segmented row: "Grandparent"
                            alone does not fit a fifth of 320pt. */}
                        <Text style={{ ...type.label, color: colors.textSecondary, marginBottom: space.xs }}>
                            I am the child's…
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.xs }}>
                            {RELATIONSHIPS.map((opt) => {
                                const on = regRelationship === opt.key;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => {
                                            setRegRelationship(opt.key);
                                            if (errors.regRelationship) setErr("regRelationship", "");
                                        }}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: on }}
                                        accessibilityLabel={opt.label}
                                        style={{
                                            minHeight: MIN_TOUCH,
                                            justifyContent: "center",
                                            paddingHorizontal: space.md,
                                            borderRadius: radius.pill,
                                            borderCurve: "continuous",
                                            borderWidth: 1,
                                            borderColor: on ? colors.primary : colors.border,
                                            backgroundColor: on ? colors.primarySoft : colors.surfaceAlt,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...type.caption,
                                                fontWeight: on ? "700" : "500",
                                                color: on ? colors.primary : colors.textSecondary,
                                            }}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {errors.regRelationship ? (
                            <Text selectable style={{ ...type.caption, color: colors.danger, marginBottom: space.md }}>
                                {errors.regRelationship}
                            </Text>
                        ) : (
                            <View style={{ marginBottom: space.md }} />
                        )}

                        <Field
                            label="Mobile Number (optional)"
                            placeholder="09XX XXX XXXX"
                            value={regPhone}
                            onChangeText={setRegPhone}
                            keyboardType="phone-pad"
                            autoComplete="tel"
                            textContentType="telephoneNumber"
                        />
                        <Field
                            label="City / Municipality (optional)"
                            placeholder="Where you live"
                            value={regCity}
                            onChangeText={setRegCity}
                            autoComplete="postal-address-locality"
                            textContentType="addressCity"
                        />

                        {/* Data-retention & privacy agreement (Data Privacy Act of 2012, RA 10173) */}
                        <View
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: radius.md,
                                borderCurve: "continuous",
                                backgroundColor: colors.surfaceAlt,
                                padding: space.md,
                                marginBottom: space.sm,
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 6 }}>
                                Data Retention & Privacy Agreement
                            </Text>
                            <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                                    By creating an account, you agree that BabyBook+ will retain your and your
                                    child's health and development records in its database to support your child's
                                    first six (6) years of health and development.
                                    {"\n\n"}Your data is <Text style={{ fontWeight: "800" }}>never deleted automatically.</Text> Each
                                    year you will be asked whether you still wish to keep your data in the app —
                                    if you confirm, it is kept for another year. Your account and records are only
                                    ever deleted if you choose to withdraw your consent.
                                    {"\n\n"}Your data is securely stored and encrypted with the intention of
                                    complying with the Data Privacy Act of 2012 (Republic Act No. 10173). You
                                    retain the right to access, correct, and erase your personal information at any time.
                                    {"\n\n"}When you share a QR consultation code, the healthcare professional's
                                    name, device, network (IP) address, and the exact time they viewed the
                                    records are recorded in your access log, viewable from Share Records.
                                </Text>
                            </ScrollView>
                        </View>

                        <TouchableOpacity
                            onPress={() => setTermsAgreed((v) => !v)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: termsAgreed }}
                            style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, marginBottom: space.xs }}
                        >
                            <View
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: radius.sm,
                                    borderWidth: 1.5,
                                    borderColor: termsAgreed ? colors.primary : colors.borderStrong,
                                    backgroundColor: termsAgreed ? colors.primary : colors.surface,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {termsAgreed ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                            </View>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                                I have read and agree to the Data Retention & Privacy Agreement above.
                            </Text>
                        </TouchableOpacity>
                        {/* Inline, beside the control it is about. This was a
                            toast, which appears elsewhere on the screen and then
                            leaves — on the one field whose whole purpose is an
                            explicit, recorded act of consent. */}
                        {errors.terms ? (
                            <Text selectable style={{ ...type.caption, color: colors.danger, marginBottom: space.sm }}>
                                {errors.terms}
                            </Text>
                        ) : null}

                        <Button title="Create Account" onPress={handleRegister} loading={loading} />

                        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: space.lg }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => setScene("login")} accessibilityRole="button">
                                <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>Log in</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {scene === "forgot" && (
                    <View style={{ gap: space.xs }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: space.xs }}>
                            Recover Password
                        </Text>
                        {forgotSent ? (
                            <View style={{ alignItems: "center", paddingVertical: space.lg, gap: space.sm }}>
                                <Ionicons name="checkmark-circle" size={44} color={colors.primary} />
                                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>Reset Email Sent!</Text>
                                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
                                    Check your inbox for instructions to reset your password.
                                </Text>
                                <Button
                                    title="Back to Log In"
                                    onPress={() => {
                                        setForgotSent(false);
                                        setScene("login");
                                    }}
                                    style={{ marginTop: space.md }}
                                />
                            </View>
                        ) : (
                            <>
                                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: space.sm }}>
                                    Enter your email and we'll send reset instructions.
                                </Text>
                                <Field
                                    label="Email Address"
                                    placeholder="Enter your email"
                                    value={forgotEmail}
                                    onChangeText={(t) => {
                                        setForgotEmail(t);
                                        if (errors.forgotEmail) setErr("forgotEmail", "");
                                    }}
                                    error={errors.forgotEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                                <Button title="Send Reset Link" onPress={handleForgot} loading={loading} />
                                <TouchableOpacity onPress={() => setScene("login")} accessibilityRole="button" style={{ alignItems: "center", paddingVertical: space.md }}>
                                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted }}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
        </ScrollView>
        </KeyboardAvoider>
    );
}
