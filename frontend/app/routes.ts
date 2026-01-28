import { type RouteConfig, index, route } from "@react-router/dev/routes";

const routes: RouteConfig = [
  index("routes/home.tsx"),  // ← This makes home.tsx the default route
  route("login", "routes/login.tsx"),
  route("recruiter", "routes/recruiter.tsx"),
];

export default routes;