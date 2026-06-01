import { createContext, useContext, useState } from "react";

export const THEMES = {
  default: {
    name: "Default", emoji: "🌿",
    cream:"#FAF4EA", paper:"#FFFDF8", ink:"#4A3F36", inkSoft:"#8B7C6B",
    sage:"#90A57F", sageDeep:"#6E8560", gold:"#D9A35B",
    blue:"#4C6A92", blueDeep:"#33506F", blueLight:"#DEE8F3",
    rose:"#D688A6", roseDeep:"#B25E80", roseLight:"#F8E4EC",
    line:"rgba(74,63,54,.10)", dark:false,
  },
  sakura: {
    name: "Sakura", emoji: "🌸",
    cream:"#FFF0F5", paper:"#FFFBFD", ink:"#3D2033", inkSoft:"#B080A0",
    sage:"#90A57F", sageDeep:"#6E8560", gold:"#D9A35B",
    blue:"#4C6A92", blueDeep:"#33506F", blueLight:"#F5E8F0",
    rose:"#FF6B9D", roseDeep:"#C0507A", roseLight:"#FFE0EA",
    line:"rgba(255,107,157,.2)", dark:false,
  },
  midnight: {
    name: "Midnight", emoji: "🌙",
    cream:"#16121E", paper:"#1E1928", ink:"#EDE0D0", inkSoft:"#9A8878",
    sage:"#7A9169", sageDeep:"#A8C494", gold:"#D9A35B",
    blue:"#6B8FBE", blueDeep:"#8FAFD8", blueLight:"#1A2535",
    rose:"#D688A6", roseDeep:"#E8A0BF", roseLight:"#26101A",
    line:"rgba(255,255,255,.11)", dark:true,
  },
  candy: {
    name: "Candy Pop", emoji: "💜",
    cream:"#FBF7FF", paper:"#FFFFFF", ink:"#2A1F3D", inkSoft:"#9080B0",
    sage:"#6B9E6E", sageDeep:"#4A7A4D", gold:"#E9A020",
    blue:"#5B75B5", blueDeep:"#3A5490", blueLight:"#E8EEFF",
    rose:"#8B50C0", roseDeep:"#6030A0", roseLight:"#F3EEFF",
    line:"rgba(139,80,192,.18)", dark:false,
  },
};

// Keep named exports for backward compat
export const LIGHT = THEMES.default;
export const DARK = THEMES.midnight;

const Ctx = createContext({ C: LIGHT, dark: false, theme: "default", setTheme: () => {}, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("hs_theme") || "default"; } catch { return "default"; }
  });
  const setTheme = (t) => {
    try { localStorage.setItem("hs_theme", t); } catch {}
    setThemeState(t);
  };
  const C = THEMES[theme] || THEMES.default;
  const toggle = () => setTheme(theme === "midnight" ? "default" : "midnight");
  return <Ctx.Provider value={{ C, dark: C.dark, theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
export const useC = () => useContext(Ctx).C;
