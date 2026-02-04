import type { Route } from "./+types/home";
import { Main } from "../main/main";

export function meta({}: Route.MetaArgs) {
  return [{ title: "mruby/c Editor" }];
}

export default function Home() {
  return <Main />;
}
