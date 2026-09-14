import React from 'react';
import AudioPlayerComponent, { RHAP_UI } from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

interface AudioPlayerProps {
  src: string;
  title?: string;
  recordingDuration?: number;
}

export function AudioPlayer({ src, title, recordingDuration }: AudioPlayerProps) {
  // react-h5-audio-player handles duration effectively, but if needed we can wrap it.
  // The default UI is quite good and fully functional.
  
  return (
    <div className="w-full bg-card rounded-xl border border-border overflow-hidden [&_.rhap_container]:!bg-transparent [&_.rhap_time]:!text-foreground [&_.rhap_progress-bar]:!bg-muted [&_.rhap_progress-filled]:!bg-primary [&_.rhap_progress-indicator]:!bg-primary [&_.rhap_main-controls-button]:!text-primary [&_.rhap_volume-button]:!text-foreground [&_.rhap_volume-indicator]:!bg-primary [&_.rhap_volume-bar]:!bg-muted flex flex-col p-2">
      {title && <div className="px-4 pt-2 text-sm font-semibold text-foreground">{title}</div>}
      <AudioPlayerComponent
        src={src}
        autoPlay={false}
        showJumpControls={true}
        showSkipControls={false}
        customProgressBarSection={[RHAP_UI.CURRENT_TIME, RHAP_UI.PROGRESS_BAR, RHAP_UI.DURATION]}
        customControlsSection={[RHAP_UI.MAIN_CONTROLS, RHAP_UI.VOLUME_CONTROLS]}
        layout="horizontal-reverse"
      />
    </div>
  );
}
