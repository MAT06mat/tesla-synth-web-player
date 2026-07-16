import { Body, Controller, Get, Put } from '@nestjs/common';
import { TagService } from './tags.service';
import { SyncTagDto } from './dto/tag.dto';
import { Tag } from './entities/tag.entity';

@Controller('tags')
export class TagController {
    constructor(private readonly tagService: TagService) { }

    @Get()
    findAll(): Promise<Tag[]> {
        return this.tagService.findAll();
    }

    /**
     * Bulk update/create/delete tags.
     * Expects the full list of tags to keep.
     */
    @Put('sync')
    syncTags(@Body() tags: SyncTagDto[]): Promise<Tag[]> {
        return this.tagService.syncAll(tags);
    }
}