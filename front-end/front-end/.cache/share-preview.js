import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { PublicSans_400Regular, PublicSans_500Medium, PublicSans_600SemiBold, PublicSans_700Bold } from '@expo-google-fonts/public-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ToastProvider } from '../components/ui/Toast';
import ShareRecords from '../components/ShareRecords';
import Gradient from '../components/ui/Gradient';
import { PALETTES, type } from '../theme';
import { api } from '../utils/api';
import { storage } from '../utils/storageAdapter';
import store from '../utils/recordStore.cjs';
const profile = {id:'visual-fixture', name:'Fixture Baby', sex:'Male', dateOfBirth:'2026-01-01'};
const data = new Map();
storage.getItem=async key=>data.get(key)||null; storage.setItem=async(key,value)=>data.set(key,value); storage.removeItem=async key=>data.delete(key);
for(const resource of ['shares','access-log']) store.acceptFetch(profile.id,resource,[],store.version(profile.id,resource));
api.listShares=async()=>[]; api.accessLog=async()=>[]; api.markAccessLogSeen=async()=>({status:'fixture'});
api.createShare=async()=>({id:'fixture-only',code:'MOCK-ONLY',status:'active',expiration_date:new Date(Date.now()+3600000).toISOString(),shared_record_keys:[]});
api.revokeShare=async()=>({status:'fixture'});
function Preview(){
 const [fonts]=useFonts({Archivo_600SemiBold,Archivo_700Bold,PublicSans_400Regular,PublicSans_500Medium,PublicSans_600SemiBold,PublicSans_700Bold,...Ionicons.font});
 if(!fonts)return <Text>Loading fixture fonts...</Text>;
 return <SafeAreaProvider><ThemeProvider gender="Male"><LanguageProvider><ToastProvider><Gradient colors={PALETTES.boy.shareSurface.background} start={{x:.5,y:0}} end={{x:.5,y:1}} style={{flex:1}}>
 <View style={{paddingHorizontal:16,paddingTop:12,flexDirection:'row',gap:8,alignItems:'center'}}><Ionicons name="chevron-back" size={24} color={PALETTES.boy.shareSurface.azure}/><Text style={{...type.caption,color:PALETTES.boy.shareSurface.secondary}}>Isolated visual fixture - sharing services mocked</Text></View>
 <ShareRecords profile={profile}/></Gradient></ToastProvider></LanguageProvider></ThemeProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
