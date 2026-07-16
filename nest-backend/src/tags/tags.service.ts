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

    // 1. Identify which tags to delete (they exist in DB but not in the incoming payload)
    const incomingIds = incomingTags.map(t => t.id).filter(id => id != null);
    const tagsToRemove = existingTags.filter(t => !incomingIds.includes(t.id));

    if (tagsToRemove.length > 0) {
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