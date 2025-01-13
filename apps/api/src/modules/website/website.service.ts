import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateWebsiteDto } from './dto/create-website.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';
import { QueryWebsiteDto } from './dto/query-website.dto';

@Injectable()
export class WebsiteService {
  dbName = 'websites';
  constructor(
    @Inject('SupabaseClient') private readonly supabase: SupabaseClient,
  ) {}
  async create(createWebsiteDto: CreateWebsiteDto) {
    const tags = createWebsiteDto.tags;
    delete createWebsiteDto.tags;

    const { data, error } = await this.supabase
      .from(this.dbName)
      .insert([createWebsiteDto])
      .select()
      .single();

    if (data && data.id) {
      const websiteId = data.id;
      if (tags && tags.length) {
        const subTags = tags.map((tag: string) => {
          return { tag_id: tag, website_id: websiteId };
        });
        const { error: tagError } = await this.supabase
          .from('website_tags')
          .insert(subTags);
        if (tagError) {
          throw new Error(`Supabase query failed: ${tagError.message}`);
        }
      }
    }
    if (error) {
      throw new Error(`Error creating category: ${error.message}`);
    }

    return data;
  }
  async update(id: string, updateWebsiteDto: UpdateWebsiteDto) {
    const tags = updateWebsiteDto.tags;
    delete updateWebsiteDto.tags;
    const excludeKeys = ['categories', 'website_tags', 'tags', 'id'];

    for (const key in updateWebsiteDto) {
      if (excludeKeys.includes(key)) {
        delete updateWebsiteDto[key];
      }
    }

    // 更新主表数据
    const { data: websiteData, error: websiteError } = await this.supabase
      .from(this.dbName)
      .update(updateWebsiteDto)
      .eq('id', id)
      .select()
      .single();

    if (websiteError) {
      throw new Error(`Error updating website: ${websiteError.message}`);
    }

    // 更新关联表数据（website_tags）
    if (tags && tags.length) {
      // 删除旧的关联
      const { error: deleteError } = await this.supabase
        .from('website_tags')
        .delete()
        .eq('website_id', id);

      if (deleteError) {
        throw new Error(`Error removing old tags: ${deleteError.message}`);
      }

      // 插入新的关联
      const subTags = tags.map((tag: string) => ({
        tag_id: tag,
        website_id: id,
      }));

      const { error: insertError } = await this.supabase
        .from('website_tags')
        .insert(subTags);

      if (insertError) {
        throw new Error(`Error adding new tags: ${insertError.message}`);
      }
    }

    return websiteData;
  }

  async findAll() {
    const { data, error } = await this.supabase
      .from(this.dbName)
      .select(
        `
      *,
      categories!websites_category_id_fkey(name),
      website_tags(
        tag_id,
        tags!website_tags_tag_id_fkey(name)
      )
    `,
      )
      .order('created_at', { ascending: false }); // 按创建时间降序排序
    // .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Error getting tafs: ${error.message}`);
    }

    return data;
  }
  async findOne(id: string) {
    const { data, error } = await this.supabase
      .from(this.dbName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Error getting taf: ${error.message}`);
    }

    return data;
  }

  async remove(id: string) {
    // 删除关联表中的数据
    const { error: tagsError } = await this.supabase
      .from('website_tags')
      .delete()
      .eq('website_id', id);

    if (tagsError) {
      throw new Error(`Error removing tags: ${tagsError.message}`);
    }

    // 删除主表中的数据
    const { data, error } = await this.supabase
      .from(this.dbName)
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error deleting website: ${error.message}`);
    }

    return data;
  }

  async findByQuery(query: QueryWebsiteDto) {
    const { page, limit, ...filters } = query;

    const offset = (page - 1) * limit;

    // 构建动态查询
    const queryBuilder = this.supabase.from(this.dbName).select(
      `*,
    categories!websites_category_id_fkey(name),
    website_tags(
      tag_id,
      tags!website_tags_tag_id_fkey(name)
    )`,
      { count: 'exact' },
    );

    const exclude = ['category_id'];
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        if (!exclude.includes(key)) {
          queryBuilder.ilike(key, `%${value}%`); // 假设需要模糊查询
        } else {
          queryBuilder.eq(key, value);
        }
      }
    }

    const { data, error, count } = await queryBuilder.range(
      offset,
      offset + limit * 1 - 1,
    );

    if (error) {
      throw new Error(`查询出错: ${error.message}`);
    }
    // 计算总页数
    const totalPages = Math.ceil((count || 0) / limit);

    return {
      list: data,
      total: count,
      totalPages,
      page,
      limit,
    };
  }
}
