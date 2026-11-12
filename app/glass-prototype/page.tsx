import type { Metadata } from "next";
import { ConvexGlassDemo } from "./convex-glass-demo";

export const metadata: Metadata = {
  title: "Convex Glass Prototype — BlueSpherix",
  description: "Prototipo isolato del vetro convesso BlueSpherix.",
};

export default function GlassPrototypePage() {
  return <ConvexGlassDemo />;
}
