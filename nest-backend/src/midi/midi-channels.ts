import { parseMidi } from 'midi-file';

/**
 * The number of channels in a Standard MIDI File.
 *
 * Returns null if the buffer cannot be parsed as a MIDI file.
 */
export function computeChannels(buffer: Buffer): number | null {
    let midi;
    try {
        midi = parseMidi(buffer);
    } catch {
        return null;
    }

    const channels = new Set<number>();
    const tracks = midi.tracks ?? [];

    for (const track of tracks) {
        for (const ev of track) {
            if ('channel' in ev && typeof ev.channel === 'number') {
                channels.add(ev.channel);
            }
        }
    }

    return channels.size;
}
