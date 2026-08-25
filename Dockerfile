# syntax=docker/dockerfile:1

# Imagen para Cloud Run. Dos etapas: la primera compila TypeScript, la segunda
# se queda solo con `dist/` y las dependencias de runtime.
#
# `node:24-slim` y no `-alpine` a propósito: `bcrypt` es un módulo nativo y
# publica binarios precompilados para glibc, no para musl. En Alpine habría que
# instalar python3 y build-essential para compilarlo en cada build.

# ---- compilación ----------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

# Los manifiestos van primero y solos: mientras no cambien, Docker reutiliza la
# capa de `npm ci` en vez de volver a bajar todo el árbol de dependencias.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# `--omit=dev` deja afuera el compilador de TypeScript, ts-node, jest y eslint.
# La imagen final solo necesita lo que `dist/` carga en runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# La imagen base ya trae el usuario `node` sin privilegios. Cloud Run no lo
# exige, pero nada en la app necesita root adentro del contenedor.
USER node

# Cloud Run inyecta PORT y `main.ts` lo lee; este valor es para cuando la imagen
# se corre a mano con `docker run`.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/main"]
