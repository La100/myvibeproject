"use client";

import { useEffect, useState } from "react";
import { useScrollToBottom } from "./useScrollToBottom";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

type UseMessagesProps = {
  status: ChatStatus;
  messagesLength?: number;
};

export function useMessages({ status, messagesLength = 0 }: UseMessagesProps) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  } = useScrollToBottom();

  const [hasSentMessage, setHasSentMessage] = useState(false);

  useEffect(() => {
    if (status === "submitted") {
      setHasSentMessage(true);
    }
  }, [status]);

  // Reset hasSentMessage when messages are cleared
  useEffect(() => {
    if (messagesLength === 0) {
      setHasSentMessage(false);
    }
  }, [messagesLength]);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  };
}
