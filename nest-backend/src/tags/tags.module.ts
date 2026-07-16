import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { Song } from '../songs/entities/song.entity';
import { TagController } from './tags.controllers';
import { TagService } from './tags.service';

@Module({
    imports: [TypeOrmModule.forFeature([Tag, Song])],
    controllers: [TagController],
    providers: [TagService],
    exports: [TagService],
})
export class TagsModule { }
