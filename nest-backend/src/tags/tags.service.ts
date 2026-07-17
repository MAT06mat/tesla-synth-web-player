import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { SyncTagDto } from './dto/tag.dto';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) { }

  /**
   * Get all available tags.
   */
  findAll(): Promise<Tag[]> {
    return this.tagRepository.find();
  }

  /**
   * Synchronize the entire tag list.
   * Creates new tags (no ID), updates existing ones, and deletes omitted ones.
   */
  async syncAll(incomingTags: SyncTagDto[]): Promise<Tag[]> {
    const existingTags = await this.tagRepository.find();

    // 1. Identify which tags to delete
    const incomingIds = incomingTags
      .map((t) => t.id)
      .filter((id): id is number => typeof id === 'number');
    const tagsToRemove = existingTags.filter((t) => !incomingIds.includes(t.id));

    if (tagsToRemove.length > 0) {
      const ids = tagsToRemove.map((t) => t.id);

      await this.tagRepository.manager
        .createQueryBuilder()
        .delete()
        .from('song_tags')
        .where('tagId IN (:...ids)', { ids })
        .execute();

      await this.tagRepository.remove(tagsToRemove);
    }

    // 2. Update existing tags and create new ones
    const savedTags: Tag[] = [];

    for (const dto of incomingTags) {
      if (dto.id) {
        // Update existing
        const existing = existingTags.find(t => t.id === dto.id);
        if (existing) {
          existing.name = dto.name;
          existing.color = dto.color;
          savedTags.push(await this.tagRepository.save(existing));
        }
      } else {
        // Create new
        const newTag = this.tagRepository.create({
          name: dto.name,
          color: dto.color,
        });
        savedTags.push(await this.tagRepository.save(newTag));
      }
    }

    return savedTags;
  }
}