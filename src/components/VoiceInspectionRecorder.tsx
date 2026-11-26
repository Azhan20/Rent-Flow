import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { useAuthenticatedApi, readApiError } from '../lib/api';

interface VoiceInspectionRecorderProps {
  onTranscriptComplete: (transcript: string) => void;
  label?: string;
}

export const VoiceInspectionRecorder: React.FC<VoiceInspectionRecorderProps> = ({
  onTranscriptComplete,
  label = 'Record Verbal Inspection Note',
}) => {
  const authenticatedFetch = useAuthenticatedApi();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Convert blob to base64
        setIsProcessing(true);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          try {
            const res = await authenticatedFetch('/api/gemini/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64Data,
                mimeType: 'audio/webm',
              }),
            });
            if (!res.ok) throw new Error(await readApiError(res));
            const data = await res.json();
            if (typeof data.transcript !== 'string' || !data.transcript.trim()) throw new Error('No speech could be transcribed.');
            onTranscriptComplete(data.transcript);
          } catch (err: any) {
            setError(err instanceof Error ? err.message : 'Voice transcription service unavailable.');
          } finally {
            setIsProcessing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Microphone access is unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        {!isRecording && !isProcessing ? (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500"
          >
            <Mic className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ) : isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white animate-pulse"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>Stop Recording (Listening...)</span>
          </button>
        ) : (
          <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>Transcribing with Gemini 3.5...</span>
          </div>
        )}

        <span className="text-[11px] text-slate-400">
          Powered by Gemini 3.5 Transcribe
        </span>
      </div>

      {error && (
        <span className="text-xs text-rose-500 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </span>
      )}
    </div>
  );
};
