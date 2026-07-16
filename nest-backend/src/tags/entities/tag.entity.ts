import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Song } from '../../songs/entities/song.entity';

@Entity({ name: 'Tag' })
export class Tag {
    @PrimaryGeneratedColumn({ name: 'id' })
    id!: number;

    @Column({ name: 'name', type: 'text' })
    name!: string;

    @Column({ name: 'color', type: 'text', default: '#46e0ff' })
    color!: string;

    @ManyToMany(() => Song, (song) => song.tags)
    songs!: Song[];
}