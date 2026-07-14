<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import axios from 'axios';
import { useMidiStore } from '@/stores/midi';
import { formatDuration } from '@/utils/format';
import type { MidiFile } from '@/types/domain';

/**
 * The MIDI file manager interface: drag-and-drop upload, searchable list,
 * download, delete, and "edit instruments". Owns all its own UI state; talks to
 * the host only through `select` (a file to use) and `edit-instruments`.
 *
 * Presentational + self-contained, so it can be hosted either inside a modal
 * (the editor's MidiLibraryModal) or directly on a page (MidiFilesView) without
 * duplicating any of this logic. Transient state (search, drag, pending delete,
 * upload message) is reset by remounting — the modal renders it with `v-if`, and
 * the page mounts it once.
 */
const props = withDefaults(defineProps<{ currentId?: number | null }>(), { currentId: null });
const emit = defineEmits<{
  (e: 'select', id: number | null): void;
  (e: 'edit-instruments', file: MidiFile): void;
}>();

const midiStore = useMidiStore();
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const dragActive = ref(false);
const librarySearch = ref('');
const pendingDelete = ref<{ id: number; name: string } | null>(null);
const uploadMsg = ref<{ type: 'success' | 'error'; name?: string } | null>(null);
const replaceInput = ref<HTMLInputElement | null>(null);
const targetReplaceId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const editName = ref('');
const editInputs = ref<HTMLInputElement[]>([]);

const filteredLibrary = computed(() => {
  const q = librarySearch.value.trim().toLowerCase();
  // Newest first, so a freshly-uploaded file appears at the top of the list.
  const list = [...midiStore.midiFileList].sort((a, b) => b.id - a.id);
  return q ? list.filter((f) => f.name.toLowerCase().includes(q)) : list;
});

function pickFile(): void {
  fileInput.value?.click();
}
function onFileChosen(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) uploadOne(f);
}
function onDrop(e: DragEvent): void {
  dragActive.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) uploadOne(f);
}
function triggerReplace(f: MidiFile): void {
  targetReplaceId.value = f.id;
  replaceInput.value?.click();
}
async function uploadOne(file: File): Promise<void> {
  uploading.value = true;
  uploadMsg.value = null;
  try {
    const form = new FormData();
    form.append('file', file);
    // No manual Content-Type: the browser sets multipart/form-data + boundary.
    const { data } = await axios.post<MidiFile>('/api/midi', form);
    midiStore.addMidiFileToList(data);
    emit('select', data.id); // auto-select the freshly uploaded file
    uploadMsg.value = { type: 'success', name: data.name };
  } catch (err) {
    console.error('MIDI upload failed', err);
    uploadMsg.value = { type: 'error', name: file.name };
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}
async function downloadFile(f: MidiFile): Promise<void> {
  // Fetch as a blob so the saved file uses the given MIDI name (the `download`
  // attribute is ignored on cross-origin <a> links, which would otherwise keep
  // the raw prefixed filename from the URL).
  try {
    const { data } = await axios.get(f.path.replace(/^\./, ''), { responseType: 'blob' });
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('MIDI download failed', err);
  }
}
async function onReplaceFileChosen(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0];
  const targetId = targetReplaceId.value;
  
  if (f && targetId !== null) {
    uploading.value = true;
    uploadMsg.value = null;
    try {
      const form = new FormData();
      form.append('file', f);
      
      const { data } = await axios.put<MidiFile>(`/api/midi/${targetId}/file`, form);
      
      const index = midiStore.midiFileList.findIndex(m => m.id === data.id);
      if (index !== -1) midiStore.midiFileList[index] = data;
      
      emit('select', data.id);
      uploadMsg.value = { type: 'success', name: data.name };
    } catch (err) {
      console.error('MIDI replace failed', err);
      uploadMsg.value = { type: 'error', name: f.name };
    } finally {
      uploading.value = false;
      if (replaceInput.value) replaceInput.value.value = '';
      targetReplaceId.value = null;
    }
  }
}
function startEditName(f: MidiFile): void {
  editingId.value = f.id;
  editName.value = f.name;
  
  nextTick(() => {
    const input = editInputs.value.find(el => el && el.dataset.id === String(f.id));
    if (input) {
      input.focus();
      input.select();
    }
  });
}

function cancelEditName(): void {
  editingId.value = null;
  editName.value = '';
}

async function saveEditName(f: MidiFile): Promise<void> {
  const newName = editName.value.trim();
  
  if (!newName || newName === f.name) {
    cancelEditName();
    return;
  }

  try {
    const { data } = await axios.patch<MidiFile>(`/api/midi/${f.id}/name`, { name: newName });
    
    const index = midiStore.midiFileList.findIndex(m => m.id === data.id);
    if (index !== -1) midiStore.midiFileList[index] = data;
  } catch (err) {
    console.error('MIDI rename failed', err);
  } finally {
    cancelEditName();
  }
}

function requestDelete(f: MidiFile): void {
  pendingDelete.value = { id: f.id, name: f.name };
}
function cancelDelete(): void {
  pendingDelete.value = null;
}
async function confirmDelete(): Promise<void> {
  const target = pendingDelete.value;
  if (!target) return;
  pendingDelete.value = null;
  try {
    await axios.delete(`/api/midi/${target.id}`);
    midiStore.deleteMidiFile(target.id);
    if (props.currentId === target.id) emit('select', null);
  } catch (err) {
    console.error('MIDI delete failed', err);
  }
}
</script>

<template>
  <div class="midi-lib" style="height: 100%;">
    <input ref="fileInput" type="file" accept=".mid,.midi" style="display: none" @change="onFileChosen">
    <input ref="replaceInput" type="file" accept=".mid,.midi" style="display: none" @change="onReplaceFileChosen">
    <div class="dropzone" :class="{ 'is-drag': dragActive }" @click="pickFile"
      @dragover.prevent="dragActive = true" @dragleave.prevent="dragActive = false" @drop.prevent="onDrop">
      <span class="dropzone__icon"><i class="fas fa-cloud-arrow-up"></i></span>
      <span class="dropzone__hint">{{ uploading ? $t('label.upload') + '…' : $t('label.dropMidiHint') }}</span>
    </div>

    <div v-if="uploadMsg && !pendingDelete" class="midi-lib__msg" :class="uploadMsg.type">
      <i class="fas" :class="uploadMsg.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
      <span v-if="uploadMsg.type === 'success'">{{ uploadMsg.name }} · {{ $t('label.uploaded') }}</span>
      <span v-else>{{ $t('label.uploadFailed') }}</span>
    </div>

    <div v-if="pendingDelete" class="midi-lib__msg confirm">
      <span class="midi-lib__confirm-text">
        <i class="fas fa-triangle-exclamation"></i>
        {{ $t('label.deleteQuestion') }} « {{ pendingDelete.name }} » ?
      </span>
      <span class="midi-lib__confirm-actions">
        <button class="btn btn--danger" type="button" @click="confirmDelete">{{ $t('label.confirm') }}</button>
        <button class="btn btn--ghost" type="button" @click="cancelDelete">{{ $t('label.cancel') }}</button>
      </span>
    </div>

    <div class="midi-lib__search">
      <input class="text-field" type="text" v-model="librarySearch" :placeholder="$t('label.search')">
    </div>

    <div class="midi-lib__list">
      <div v-if="filteredLibrary.length === 0" class="midi-lib__empty">{{ $t('label.noResults') }}</div>
      <div v-for="f in filteredLibrary" :key="f.id" class="midi-lib__item"
        :class="{ 'is-current': f.id === currentId }">
        <span v-if="editingId === f.id" class="midi-lib__item-name-edit">
          <input 
            type="text" 
            v-model="editName" 
            :data-id="f.id"
            ref="editInputs"
            @keyup.enter="saveEditName(f)" 
            @keyup.esc="cancelEditName" 
            @blur="saveEditName(f)" 
          />
          <button type="button" class="midi-lib__edit-icon" title="Valider" @mousedown.prevent="saveEditName(f)">
            <i class="fas fa-check"></i>
          </button>
          <button type="button" class="midi-lib__edit-icon is-cancel" title="Annuler" @mousedown.prevent="cancelEditName">
            <i class="fas fa-xmark"></i>
          </button>
        </span>
        <span v-else class="midi-lib__item-name" @dblclick="startEditName(f)">
          {{ f.name }}
        </span>
        <span class="midi-lib__item-dur">{{ formatDuration(f.durationMs) }}</span>
        <span class="midi-lib__item-ch">{{ f.channels }} ch</span>
        <div class="midi-lib__item-actions">
          <button class="midi-lib__dl" type="button" :title="$t('label.editInstruments')"
            @click="emit('edit-instruments', f)">
            <i class="fas fa-guitar"></i>
          </button>
          <div class="midi-lib__dropdown">
            <button class="midi-lib__action" type="button">
              <i class="fas fa-ellipsis-vertical"></i>
            </button>
            <div class="midi-lib__dropdown-menu">
              <button class="midi-lib__dropdown-item" type="button" @click="startEditName(f)">
                <i class="fa-solid fa-pen"></i>
                <span>{{ $t('label.rename') }}</span>
              </button>
              <button class="midi-lib__dropdown-item" type="button" @click="triggerReplace(f)">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>{{ $t('label.upload') }}</span>
              </button>
              <button class="midi-lib__dropdown-item" type="button" @click="downloadFile(f)">
                <i class="fas fa-download"></i>
                <span>{{ $t('label.download') }}</span>
              </button>
              
              <div class="midi-lib__dropdown-divider"></div>
              
              <button class="midi-lib__dropdown-item is-danger" type="button" @click="requestDelete(f)">
                <i class="fas fa-trash"></i>
                <span>{{ $t('label.delete') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
