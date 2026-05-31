import { createContext, useContext, useState } from "react";

export const LIGHT = {
  cream:"#FAF4EA", paper:"#FFFDF8", ink:"#4A3F36", inkSoft:"#8B7C6B",
  sage:"#90A57F", sageDeep:"#6E8560", gold:"#D9A35B",
  blue:"#4C6A92", blueDeep:"#33506F", blueLight:"#DEE8F3",
  rose:"#D688A6", roseDeep:"#B25E80", roseLight:"#F8E4EC",
  line:"rgba(74,63,54,.10)",
};

export const DARK = {
  cream:"#16121E", paper:"#1E1928", ink:"#EDE0D0", inkSoft:"#9A8878",
  sage:"#7A9169", sageDeep:"#A8C494", gold:"#D9A35B",
  blue:"#6B8FBE", blueDeep:"#8FAFD8", blueLight:"#1A2535",
  rose:"#D688A6", roseDeep:"#E8A0BF", roseLight:"#26101A",
  line:"rgba(255,255,255,.11)",
};

const Ctx = createContext({ C: LIGHT, dark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("hs_dark") === "1"; } catch { return false; }
  });
  const toggle = () => setDark(d => {
    const next = !d;
    try { localStorage.setItem("hs_dark", next ? "1" : "0"); } catch {}
    return next;
  });
  return <Ctx.Provider value={{ C: dark ? DARK : LIGHT, dark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
export const useC = () => useContext(Ctx).C;
