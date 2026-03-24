import AIAssistant from "@/components/ai/assistant/AIAssistant";

const AIPage = () => {
  return (
    <div
      className="ai-chat-page h-full min-h-0 -m-4 bg-background xl:-m-8"
      style={{ backgroundImage: "none" }}
    >
      <AIAssistant />
    </div>
  );
};

export default AIPage;
