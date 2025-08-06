// vite.config.ts
import { defineConfig } from "file:///Users/balajiboominathan/Documents/newsylangcursor/src/diagrams/webview/node_modules/vite/dist/node/index.js";
import preact from "file:///Users/balajiboominathan/Documents/newsylangcursor/src/diagrams/webview/node_modules/@preact/preset-vite/dist/esm/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/Users/balajiboominathan/Documents/newsylangcursor/src/diagrams/webview";
var vite_config_default = defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  const isDevelopment = mode === "development";
  return {
    plugins: [preact()],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__vite_injected_original_dirname, "src/main.tsx")
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name].[ext]"
        }
      },
      target: isDevelopment ? "esnext" : "es2020",
      minify: isProduction,
      sourcemap: !isProduction
    },
    resolve: {
      alias: {
        "@": resolve(__vite_injected_original_dirname, "src")
      }
    },
    define: {
      "process.env.NODE_ENV": `"${mode}"`
    },
    esbuild: {
      target: isDevelopment ? "esnext" : "es2020",
      drop: isProduction ? ["console", "debugger"] : []
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYmFsYWppYm9vbWluYXRoYW4vRG9jdW1lbnRzL25ld3N5bGFuZ2N1cnNvci9zcmMvZGlhZ3JhbXMvd2Vidmlld1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2JhbGFqaWJvb21pbmF0aGFuL0RvY3VtZW50cy9uZXdzeWxhbmdjdXJzb3Ivc3JjL2RpYWdyYW1zL3dlYnZpZXcvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2JhbGFqaWJvb21pbmF0aGFuL0RvY3VtZW50cy9uZXdzeWxhbmdjdXJzb3Ivc3JjL2RpYWdyYW1zL3dlYnZpZXcvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBwcmVhY3QgZnJvbSAnQHByZWFjdC9wcmVzZXQtdml0ZSc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgaXNQcm9kdWN0aW9uID0gbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nO1xuICBjb25zdCBpc0RldmVsb3BtZW50ID0gbW9kZSA9PT0gJ2RldmVsb3BtZW50JztcbiAgXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW3ByZWFjdCgpXSxcbiAgICBidWlsZDoge1xuICAgICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICBtYWluOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9tYWluLnRzeCcpXG4gICAgICAgIH0sXG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnW25hbWVdLmpzJyxcbiAgICAgICAgICBjaHVua0ZpbGVOYW1lczogJ1tuYW1lXS5qcycsXG4gICAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdbbmFtZV0uW2V4dF0nXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB0YXJnZXQ6IGlzRGV2ZWxvcG1lbnQgPyAnZXNuZXh0JyA6ICdlczIwMjAnLFxuICAgICAgbWluaWZ5OiBpc1Byb2R1Y3Rpb24sXG4gICAgICBzb3VyY2VtYXA6ICFpc1Byb2R1Y3Rpb25cbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgICdAJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKVxuICAgICAgfVxuICAgIH0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAncHJvY2Vzcy5lbnYuTk9ERV9FTlYnOiBgXCIke21vZGV9XCJgXG4gICAgfSxcbiAgICBlc2J1aWxkOiB7XG4gICAgICB0YXJnZXQ6IGlzRGV2ZWxvcG1lbnQgPyAnZXNuZXh0JyA6ICdlczIwMjAnLFxuICAgICAgZHJvcDogaXNQcm9kdWN0aW9uID8gWydjb25zb2xlJywgJ2RlYnVnZ2VyJ10gOiBbXVxuICAgIH1cbiAgfTtcbn0pOyAiXSwKICAibWFwcGluZ3MiOiAiO0FBQXVZLFNBQVMsb0JBQW9CO0FBQ3BhLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWU7QUFGeEIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxlQUFlLFNBQVM7QUFDOUIsUUFBTSxnQkFBZ0IsU0FBUztBQUUvQixTQUFPO0FBQUEsSUFDTCxTQUFTLENBQUMsT0FBTyxDQUFDO0FBQUEsSUFDbEIsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsYUFBYTtBQUFBLE1BQ2IsZUFBZTtBQUFBLFFBQ2IsT0FBTztBQUFBLFVBQ0wsTUFBTSxRQUFRLGtDQUFXLGNBQWM7QUFBQSxRQUN6QztBQUFBLFFBQ0EsUUFBUTtBQUFBLFVBQ04sZ0JBQWdCO0FBQUEsVUFDaEIsZ0JBQWdCO0FBQUEsVUFDaEIsZ0JBQWdCO0FBQUEsUUFDbEI7QUFBQSxNQUNGO0FBQUEsTUFDQSxRQUFRLGdCQUFnQixXQUFXO0FBQUEsTUFDbkMsUUFBUTtBQUFBLE1BQ1IsV0FBVyxDQUFDO0FBQUEsSUFDZDtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSyxRQUFRLGtDQUFXLEtBQUs7QUFBQSxNQUMvQjtBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLHdCQUF3QixJQUFJLElBQUk7QUFBQSxJQUNsQztBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsUUFBUSxnQkFBZ0IsV0FBVztBQUFBLE1BQ25DLE1BQU0sZUFBZSxDQUFDLFdBQVcsVUFBVSxJQUFJLENBQUM7QUFBQSxJQUNsRDtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
