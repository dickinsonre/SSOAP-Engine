import { AlertCircle, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold mb-2" data-testid="text-404-title">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <Button data-testid="button-go-home">
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
