// app/root.tsx
// This is the correct root file for the Ratna-Babu AI Resume Analyzer project

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import type { Route } from "./+types/root";

import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">{message}</h1>
        <p className="text-gray-600 text-lg mb-4">{details}</p>
        {stack && (
          <details className="mt-4">
            <summary className="cursor-pointer text-purple-600 font-semibold">
              Show error details
            </summary>
            <pre className="mt-4 bg-gray-100 p-4 rounded-lg overflow-auto text-xs">
              <code>{stack}</code>
            </pre>
          </details>
        )}
        <div className="flex gap-4 mt-6">
          <a
            href="/"
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition font-semibold"
          >
            Go Home
          </a>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
          >
            Reload Page
          </button>
        </div>
      </div>
    </main>
  );
}