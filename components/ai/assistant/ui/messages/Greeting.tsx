"use client";

export const Greeting = () => {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[44rem] flex-col items-center justify-center gap-16 py-16 text-center">
      <div className="flex w-full flex-col items-center justify-center px-4">
        <h1 className="animate-in fade-in slide-in-from-bottom-1 font-semibold text-2xl duration-200">
          Hi, I&apos;m your AI assistant.
        </h1>
        <p className="animate-in fade-in slide-in-from-bottom-1 text-muted-foreground text-xl delay-75 duration-200">
          I&apos;m here to help you get things done. What would you like to work on?
        </p>
      </div>
    </div>
  );
};
