import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Ambient */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />
      </div>

      <div className="text-center space-y-6 max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">
            Interview<span className="text-primary">Signal</span>
          </span>
        </div>

        {/* 404 display */}
        <div>
          <p className="text-8xl font-extrabold text-primary/30 leading-none">404</p>
          <h1 className="text-2xl font-bold text-foreground mt-4">Page not found</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/recent-questions"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Interview Questions
        </Link>
      </div>
    </div>
  );
}
