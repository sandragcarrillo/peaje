import { peajeProxy } from "@peaje/next/proxy";

// Responde el 402 en usepeaje.com para las rutas con precio del sitio "peaje"
// y deja pasar todo lo demás (login, dashboard, radar) sin tocarlo.
export default peajeProxy({ slug: "peaje" });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
