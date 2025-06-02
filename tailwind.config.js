/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    fontFamily: {
      sans: [
        '"Inter Tight"',
        "ui-sans-serif",
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
      ],
      grover: ['"Irish Grover"', "cursive"],
    },
    extend: {
      colors: {
        txt: {
          focus: "rgba(211, 115, 255, 1)",
          primary: "#FFFFFF", // Trắng
          secondary: "#73798D", // Xám nhạt
          tertiary: "#4A4F61", // Xám đậm hơn
        },
        bd: { default: "#2D384B" },
        bgc: {
          "layer-semi-neutral": "rgba(164, 164, 164, 0.25)",
          "layer-semi-purple": "rgba(146, 53, 190, 0.25)",
          layer2: "#202636", // Xám rất đậm
          layer1: "#0B0C1D", // Gần đen
        },
        lav: {
          500: "rgba(211, 115, 255, 1)", // Tím nhạt
          600: "rgba(201, 98, 249, 1)", // Tím vừa
        },
        btn: {
          primary: "rgba(211, 115, 255, 1)", // Tím nhạt
        },
        success: {
          success: "#25EBAC", // Màu xanh success từ Figma
        },
        error: {
          error: "#FF4444", // Màu đỏ error
        },
      },
    },
  },
  plugins: [],
};
