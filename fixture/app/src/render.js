import "./render.css";
import "swiper/css";
import { renderSwiper } from "component";

export function render() {
  const el = document.createElement("div");
  el.classList.add("text");
  document.getElementsByTagName("body")[0].appendChild(el);
  el.innerHTML = "hello, world";

  renderSwiper(".swiper-container");
}
