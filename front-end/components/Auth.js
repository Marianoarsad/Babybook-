import React, { useCallback, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Modal from "./ui/AppModal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../utils/api";
import { RELATIONSHIPS } from "../utils/relationship";
import { useTheme } from "../context/ThemeContext";
import { MIN_TOUCH, radius, space, type } from "../theme";
import Button from "./ui/Button";
import Field from "./ui/Field";
import KeyboardAvoider from "./ui/KeyboardAvoider";
import SocialSignIn from "./auth/SocialSignIn";
import { useToast } from "./ui/Toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Auth({ onLoginSuccess, onProfessional, onBack, initialScene = "login" }) {
    const { colors } = useTheme();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const heroHeight = Math.max(140, Math.min(220, width * 0.54, height * 0.27));
    const styles = useMemo(() => makeStyles(colors, width >= 600), [colors, width]);
    const toast = useToast();
    const [scene, setScene] = useState(initialScene);
    const [registerStep, setRegisterStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingProvider, setLoadingProvider] = useState("");
    const [errors, setErrors] = useState({});
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [regName, setRegName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPass, setRegPass] = useState("");
    const [regConfirm, setRegConfirm] = useState("");
    const [relationship, setRelationship] = useState("");
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotSent, setForgotSent] = useState(false);
    const [socialPending, setSocialPending] = useState(null);

    const setErr = (key, value) => setErrors((current) => ({ ...current, [key]: value }));
    const showSocialError = useCallback((error) => toast.error(error?.message || "Social sign-in failed"), [toast]);
    const finishAuth = useCallback(({ user, token }) => onLoginSuccess(user, token), [onLoginSuccess]);

    const handleSocialCredential = useCallback(async (provider, credential) => {
        setLoadingProvider(provider);
        try {
            const result = await api.socialAuth({ provider, credential });
            if (result.status === "authenticated") return await finishAuth(result);
            setSocialPending({ token: result.socialToken, profile: result.profile });
            if (result.status === "link_required") {
                setPassword("");
                setScene("link");
                return;
            }
            setRegName(result.profile.name || "");
            setRegEmail(result.profile.email || "");
            setRegPass("");
            setRegConfirm("");
            setRegisterStep(1);
            setScene("register");
        } catch (error) {
            showSocialError(error);
        } finally {
            setLoadingProvider("");
        }
    }, [finishAuth, showSocialError]);

    const handleLogin = async () => {
        const next = {};
        if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address";
        if (!password) next.password = "Password is required";
        setErrors(next);
        if (Object.keys(next).length) return;
        setLoading(true);
        try { await finishAuth(await api.login({ email: email.trim(), password })); }
        catch (error) { toast.error(error.message || "Login failed"); }
        finally { setLoading(false); }
    };

    const validateCredentials = () => {
        const next = {};
        if (!regName.trim()) next.regName = "Your name is required";
        if (!EMAIL_RE.test(regEmail.trim())) next.regEmail = "Enter a valid email address";
        if (regPass.length < 8) next.regPass = "Use at least 8 characters";
        if (regConfirm !== regPass) next.regConfirm = "Passwords don't match";
        setErrors(next);
        if (Object.keys(next).length) return;
        setRegisterStep(2);
    };

    const handleRegister = async () => {
        const next = {};
        if (!relationship) next.relationship = "Choose your role";
        if (!termsAgreed) next.terms = "Please accept the privacy agreement";
        setErrors(next);
        if (Object.keys(next).length) return;
        setLoading(true);
        const body = { fullName: regName.trim(), password: regPass, relationship, consentAccepted: true };
        try {
            const result = socialPending
                ? await api.socialRegister({ ...body, socialToken: socialPending.token })
                : await api.register({ ...body, email: regEmail.trim() });
            await finishAuth(result);
        } catch (error) { toast.error(error.message || "Registration failed"); }
        finally { setLoading(false); }
    };

    const handleLink = async () => {
        if (!password) return setErr("password", "Password is required");
        setLoading(true);
        try { await finishAuth(await api.socialLink({ socialToken: socialPending.token, password })); }
        catch (error) { toast.error(error.message || "Could not link this account"); }
        finally { setLoading(false); }
    };

    const handleForgot = async () => {
        if (!EMAIL_RE.test(forgotEmail.trim())) return setErr("forgotEmail", "Enter a valid email address");
        setLoading(true);
        try { await api.forgotPassword({ email: forgotEmail.trim() }); setForgotSent(true); }
        catch (error) { toast.error(error.message || "Could not send reset email"); }
        finally { setLoading(false); }
    };

    const goLogin = () => { setScene("login"); setSocialPending(null); setRegisterStep(1); setErrors({}); };
    const goRegister = () => { setScene("register"); setSocialPending(null); setRegisterStep(1); setErrors({}); };
    const isRegister = scene === "register";

    return (
        <KeyboardAvoider>
            <View style={styles.page}>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    contentContainerStyle={[
                        styles.scroll,
                        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl },
                    ]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.phoneCanvas}>
                        <Image
                            source={isRegister ? require("../assets/auth-register-hero.png") : require("../assets/auth-login-hero.png")}
                            style={[styles.hero, { height: registerStep === 2 && isRegister ? Math.min(heroHeight, 170) : heroHeight }]}
                            resizeMode="contain"
                            accessibilityLabel={isRegister ? "A caregiver and baby starting their BabyBook" : "A caregiver using BabyBook+ while holding a baby"}
                        />
                        <View style={styles.formPanel}>
                            {onBack && ["login", "register"].includes(scene) ? <Link onPress={onBack} icon="arrow-back" label="Back" colors={colors} style={styles.back} /> : null}
                            {scene === "login" ? (
                                <>
                                    <Heading title="Welcome back" body="Your baby’s health, growth, and memories are right where you left them." styles={styles} />
                                    <Field label="Email address" placeholder="you@example.com" value={email} onChangeText={(value) => { setEmail(value); setErr("email", ""); }} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" />
                                    <Field label="Password" placeholder="Enter your password" value={password} onChangeText={(value) => { setPassword(value); setErr("password", ""); }} error={errors.password} secureTextEntry autoComplete="current-password" textContentType="password" />
                                    <Link onPress={() => setScene("forgot")} label="Forgot password?" colors={colors} style={styles.forgot} />
                                    <Button loadingIndicator={false} title="Log In" icon="arrow-forward" onPress={handleLogin} loading={loading} />
                                    <Divider label="or continue with" colors={colors} />
                                    <SocialSignIn onCredential={handleSocialCredential} onError={showSocialError} loadingProvider={loadingProvider} />
                                    <InlineSwitch prompt="New to BabyBook+?" action="Create an account" onPress={goRegister} colors={colors} />
                                    <TouchableOpacity onPress={onProfessional} accessibilityRole="button" style={styles.professional}><Ionicons name="medkit-outline" size={18} color={colors.textSecondary} /><Text style={styles.professionalText}>Healthcare professional access</Text></TouchableOpacity>
                                </>
                            ) : scene === "register" ? (
                                <>
                                    <Heading title="Start your BabyBook" body="Keep every record, milestone, and memory together from day one." styles={styles} />
                                    <StepProgress step={registerStep} colors={colors} styles={styles} />
                                    {registerStep === 1 ? (
                                        <>
                                            {socialPending ? <View style={styles.verified}><Ionicons name="checkmark-circle" size={18} color={colors.success} /><Text style={styles.verifiedText}>{socialPending.profile.provider} account verified</Text></View> : null}
                                            <Field label="Your full name" placeholder="Enter your name" value={regName} onChangeText={(value) => { setRegName(value); setErr("regName", ""); }} error={errors.regName} autoComplete="name" textContentType="name" />
                                            <Field label="Email address" placeholder="you@example.com" value={regEmail} editable={!socialPending} onChangeText={(value) => { setRegEmail(value); setErr("regEmail", ""); }} error={errors.regEmail} helper={socialPending ? "Verified by your provider" : "Used to sign in and recover your account."} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" />
                                            <Field label={socialPending ? "Create a backup password" : "Password"} placeholder="At least 8 characters" value={regPass} onChangeText={(value) => { setRegPass(value); setErr("regPass", ""); }} error={errors.regPass} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
                                            <Field label="Confirm password" placeholder="Enter it again" value={regConfirm} onChangeText={(value) => { setRegConfirm(value); setErr("regConfirm", ""); }} error={errors.regConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
                                            <Button title="Continue" icon="arrow-forward" onPress={validateCredentials} />
                                            {!socialPending ? <><Divider label="or sign up with" colors={colors} /><SocialSignIn onCredential={handleSocialCredential} onError={showSocialError} loadingProvider={loadingProvider} /></> : null}
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.sectionLabel}>I am the baby’s…</Text>
                                            <View style={styles.chips}>{RELATIONSHIPS.map((option) => <RoleChip key={option.key} option={option} selected={relationship === option.key} onPress={() => { setRelationship(option.key); setErr("relationship", ""); }} colors={colors} />)}</View>
                                            {errors.relationship ? <Text style={styles.error}>{errors.relationship}</Text> : null}
                                            <View style={styles.consentCard}><Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} /><View style={{ flex: 1 }}><Text style={styles.consentTitle}>Your family’s data stays parent-controlled</Text><Text style={styles.consentBody}>BabyBook+ stores account and child records for up to six years. You can review, export, or delete them.</Text><Link onPress={() => setTermsOpen(true)} label="Read the full privacy agreement" colors={colors} /></View></View>
                                            <TouchableOpacity onPress={() => { setTermsAgreed((value) => !value); setErr("terms", ""); }} accessibilityRole="checkbox" accessibilityState={{ checked: termsAgreed }} style={styles.checkboxRow}><Ionicons name={termsAgreed ? "checkbox" : "square-outline"} size={24} color={termsAgreed ? colors.primary : colors.textMuted} /><Text style={styles.checkboxText}>I understand and agree to the privacy and data-retention terms.</Text></TouchableOpacity>
                                            {errors.terms ? <Text style={styles.error}>{errors.terms}</Text> : null}
                                            <View style={styles.stepActions}><Button title="Back" variant="ghost" onPress={() => setRegisterStep(1)} style={{ flex: 1 }} /><Button loadingIndicator={false} title="Create Account" icon="arrow-forward" onPress={handleRegister} loading={loading} style={{ flex: 2 }} /></View>
                                        </>
                                    )}
                                    <InlineSwitch prompt="Already have an account?" action="Log in" onPress={goLogin} colors={colors} />
                                </>
                            ) : scene === "forgot" ? (
                                <>
                                    <Link onPress={goLogin} icon="arrow-back" label="Back to login" colors={colors} style={styles.back} />
                                    <Heading title="Reset your password" body="Enter your account email and we’ll send the next step." styles={styles} />
                                    {forgotSent ? <View style={styles.successCard}><Ionicons name="mail-outline" size={28} color={colors.success} /><Text style={styles.successTitle}>Check your inbox</Text><Text style={styles.successBody}>If an account exists for that email, a reset link is on its way.</Text></View> : <><Field label="Email address" placeholder="you@example.com" value={forgotEmail} onChangeText={(value) => { setForgotEmail(value); setErr("forgotEmail", ""); }} error={errors.forgotEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Button loadingIndicator={false} title="Send Reset Link" onPress={handleForgot} loading={loading} /></>}
                                </>
                            ) : (
                                <>
                                    <Link onPress={goLogin} icon="arrow-back" label="Use another method" colors={colors} style={styles.back} />
                                    <Heading title="Confirm it’s your account" body={`${socialPending?.profile?.email || "This email"} already has a BabyBook+. Enter its password once to link ${socialPending?.profile?.provider || "this provider"}.`} styles={styles} />
                                    <Field label="Current BabyBook+ password" placeholder="Enter your password" value={password} onChangeText={(value) => { setPassword(value); setErr("password", ""); }} error={errors.password} secureTextEntry autoComplete="current-password" textContentType="password" />
                                    <Button loadingIndicator={false} title="Confirm and Link" icon="link-outline" onPress={handleLink} loading={loading} />
                                </>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </View>
            <PrivacyModal visible={termsOpen} onClose={() => setTermsOpen(false)} colors={colors} />
        </KeyboardAvoider>
    );
}

function Heading({ title, body, styles }) { return <View style={styles.heading}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{body}</Text></View>; }
function Divider({ label, colors }) { return <View style={{ flexDirection: "row", alignItems: "center", marginVertical: space.lg }}><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /><Text style={{ ...type.caption, color: colors.textMuted, marginHorizontal: space.md }}>{label}</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.border }} /></View>; }
function Link({ onPress, label, icon, colors, style }) { return <TouchableOpacity onPress={onPress} accessibilityRole="button" style={[{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.xs }, style]}>{icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}<Text style={{ ...type.label, color: colors.primary }}>{label}</Text></TouchableOpacity>; }
function InlineSwitch({ prompt, action, onPress, colors }) { return <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: space.lg }}><Text style={{ ...type.caption, color: colors.textSecondary }}>{prompt} </Text><TouchableOpacity onPress={onPress} accessibilityRole="button" style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}><Text style={{ ...type.label, color: colors.primary }}>{action}</Text></TouchableOpacity></View>; }
function StepProgress({ step, colors, styles }) { return <View style={styles.steps}><Text style={{ ...type.caption, color: colors.primary }}>Step {step} of 2</Text><View style={styles.stepBars}><View style={[styles.stepBar, { backgroundColor: colors.primary }]} /><View style={[styles.stepBar, { backgroundColor: step === 2 ? colors.primary : colors.border }]} /></View></View>; }
function RoleChip({ option, selected, onPress, colors }) { return <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }}><Text style={{ ...type.caption, color: selected ? colors.primaryDark : colors.textSecondary }}>{option.label}</Text></TouchableOpacity>; }
function PrivacyModal({ visible, onClose, colors }) { return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={modalStyles.backdrop}><View style={[modalStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ ...type.title, color: colors.text }}>Privacy and data retention</Text><ScrollView style={{ maxHeight: 380 }}><Text style={{ ...type.body, color: colors.textSecondary }}>BabyBook+ collects the caregiver account details and the child health, growth, appointment, and memory records you choose to add. We use them only to provide the app, synchronize your records, and enable temporary parent-controlled sharing with a healthcare professional.{"\n\n"}Records are retained for up to six years unless you delete your account sooner. Sensitive profile fields are encrypted at rest. You may view, correct, export, or permanently delete your data from Settings, and you may withdraw consent at any time by deleting the account.{"\n\n"}By creating an account, you confirm that you are authorized to manage the child’s information and consent to this processing under the Philippines Data Privacy Act of 2012.</Text></ScrollView><Button title="Close" onPress={onClose} /></View></View></Modal>; }

const modalStyles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "center", padding: space.lg }, card: { width: "100%", maxWidth: 430, alignSelf: "center", borderWidth: 1, borderRadius: radius.xl, padding: space.xl, gap: space.lg } });
const makeStyles = (colors, widePreview) => StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, alignItems: "center", backgroundColor: colors.background },
    phoneCanvas: { width: "100%", maxWidth: 430, flexGrow: 1, alignSelf: "center", backgroundColor: colors.surface, paddingTop: widePreview ? space.xl : 0 },
    hero: { width: "86%", alignSelf: "center", marginBottom: space.sm },
    formPanel: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },
    back: { alignSelf: "flex-start", marginBottom: space.sm },
    heading: { alignItems: "center", gap: space.xs, marginBottom: space.lg },
    title: { ...type.title, color: colors.text, textAlign: "center" },
    subtitle: { ...type.body, color: colors.textSecondary, textAlign: "center" },
    forgot: { alignSelf: "flex-end", marginTop: -space.sm, marginBottom: space.sm },
    professional: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, marginTop: space.sm },
    professionalText: { ...type.label, color: colors.textSecondary },
    steps: { alignItems: "center", gap: space.sm, marginBottom: space.lg },
    stepBars: { width: 116, flexDirection: "row", gap: space.xs },
    stepBar: { flex: 1, height: 4, borderRadius: radius.pill },
    verified: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md, backgroundColor: colors.successBg, padding: space.md, marginBottom: space.lg },
    verifiedText: { ...type.label, color: colors.success, textTransform: "capitalize" },
    sectionLabel: { ...type.label, color: colors.textSecondary, marginBottom: space.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
    error: { ...type.caption, color: colors.danger, marginBottom: space.md },
    consentCard: { flexDirection: "row", alignItems: "flex-start", gap: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, padding: space.lg, marginVertical: space.lg },
    consentTitle: { ...type.bodyStrong, color: colors.text, marginBottom: space.xs },
    consentBody: { ...type.caption, color: colors.textSecondary },
    checkboxRow: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "flex-start", gap: space.sm },
    checkboxText: { ...type.body, color: colors.textSecondary, flex: 1 },
    stepActions: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
    successCard: { alignItems: "center", gap: space.sm, borderRadius: radius.lg, backgroundColor: colors.successBg, padding: space.xl },
    successTitle: { ...type.heading, color: colors.success },
    successBody: { ...type.body, color: colors.textSecondary, textAlign: "center" },
});
