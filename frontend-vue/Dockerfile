# -- base --
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

# -- build --
FROM base AS build
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm run build

# -- production --
FROM node:24-alpine AS production
	
RUN npm install -g serve
	
WORKDIR /app
COPY --from=build /app/dist ./dist
	
EXPOSE 4173
CMD ["serve", "dist", "-l", "4173"]