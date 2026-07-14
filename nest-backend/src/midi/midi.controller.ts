import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EditorName } from '../auth/editor-name.decorator';
import { SetProgramsDto } from './dto/set-programs.dto';
import { midiUploadOptions } from './midi-upload.config';
import { MidiFileResponse, MidiService } from './midi.service';

@Controller('midi')
export class MidiController {
  constructor(private readonly midiService: MidiService) { }

  @Get()
  findAll(): Promise<MidiFileResponse[]> {
    return this.midiService.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', midiUploadOptions))
  upload(
    @EditorName() editorName: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MidiFileResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
    return this.midiService.create(nameWithoutExt, file.filename, editorName);
  }

  /**
   * Rewrite the per-channel instruments (Program Changes) of the MIDI FILE.
   * This edits the file on disk → it affects every song that uses it.
   */
  @Patch(':id/programs')
  setPrograms(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetProgramsDto,
    @EditorName() editorName: string | null,
  ): Promise<MidiFileResponse> {
    return this.midiService.setPrograms(id, dto.programs, editorName);
  }

  /**
   * Replace an existing MIDI file's content on disk while keeping its physical path.
   * Updates its metadata (duration, channels, hash, etc).
   */
  @Put(':id/file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: midiUploadOptions.limits,
      fileFilter: midiUploadOptions.fileFilter,
    }),
  )
  replaceFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @EditorName() editorName: string | null,
  ): Promise<MidiFileResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
    return this.midiService.replaceFile(id, file.buffer, nameWithoutExt, editorName);
  }

  /**
   * Rename a MIDI file.
   */
  @Patch(':id/name')
  rename(
    @Param('id', ParseIntPipe) id: number,
    @Body('name') name: string,
    @EditorName() editorName: string | null,
  ): Promise<MidiFileResponse> {
    if (!name || name.trim() === '') {
      throw new BadRequestException('Le nom ne peut pas être vide');
    }
    return this.midiService.rename(id, name.trim(), editorName);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<string> {
    await this.midiService.remove(id);
    return 'OK';
  }
}
