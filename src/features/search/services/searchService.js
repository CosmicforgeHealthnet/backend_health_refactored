// services/searchService.js
const AppDataSource = require('../../../config/database');
const cache = require("../../../shared/utils/cache");
const {
  ENTITY_PERMISSIONS,
  SENSITIVE_FIELDS,
  SENSITIVE_ENTITIES,
  SEARCHABLE_COLUMN_TYPES,
  COLUMN_WEIGHTS,
  USER_FILTERS,
  COMMON_SEARCH_TERMS,
  SEARCH_SETTINGS,
  SENSITIVE_PATTERNS
} = require("../../../config/searchConfig");

class SearchService {
  constructor() {
    this.entityPermissions = ENTITY_PERMISSIONS;
    this.sensitiveFields = SENSITIVE_FIELDS;
    this.sensitiveEntities = SENSITIVE_ENTITIES;
  }

  /**
   * Universal search with user context
   */
  async search(query, userId, userRole, filters = {}) {
    try {
      // Validate and sanitize query
      if (!query || query.trim().length < SEARCH_SETTINGS.MIN_QUERY_LENGTH) {
        return { results: {}, total: 0, suggestions: [] };
      }

      const sanitizedQuery = this.sanitizeQuery(query.trim());

      // 🔧 Extract search parameters from entity filters
      const { category, limit, offset, ...entityFilters } = filters;

      // Log search for analytics (anonymized) - with error handling
      try {
        await this.logSearch(sanitizedQuery, userRole);
      } catch (logError) {
        console.warn('Search logging failed (non-critical):', logError.message);
      }

      // Get user-specific searchable entities
      const searchableEntities = await this.getSearchableEntities(userId, userRole);

      // Perform search across all accessible entities
      const results = await this.performContextualSearch(
        sanitizedQuery,
        searchableEntities,
        userId,
        userRole,
        {
          category,
          limit: parseInt(limit) || SEARCH_SETTINGS.MAX_RESULTS_PER_ENTITY,
          ...entityFilters // Only pass actual database column filters
        }
      );

      // Generate suggestions
      const suggestions = await this.generateSuggestions(sanitizedQuery, userRole);

      return {
        query: sanitizedQuery,
        results,
        total: this.calculateTotalResults(results),
        suggestions,
        searchTime: Date.now()
      };

    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Search failed');
    }
  }

  /**
   * Get entities user can search based on role and permissions
   */
  async getSearchableEntities(userId, userRole) {
    const cacheKey = `searchable_entities:${userRole}`;
    let entities = await cache.get(cacheKey);

    if (!entities) {
      entities = await this.discoverEntities();
      // Filter based on role permissions
      entities = this.filterEntitiesByRole(entities, userRole);
      await cache.set(cacheKey, entities, SEARCH_SETTINGS.CACHE_TTL);
    }

    return entities;
  }

  /**
   * Dynamically discover all database entities
   */
  async discoverEntities() {
    try {
      const entityMetadatas = AppDataSource.entityMetadatas;
      const entities = {};

      for (const metadata of entityMetadatas) {
        const entityName = metadata.name;

        // Skip sensitive entities
        if (this.sensitiveEntities.includes(entityName)) {
          continue;
        }

        // Get searchable columns
        const searchableColumns = metadata.columns
          .filter(column => this.isSearchableColumn(column))
          .map(column => ({
            name: column.propertyName,
            type: column.type,
            weight: this.getColumnWeight(column.propertyName)
          }));

        if (searchableColumns.length > 0) {
          entities[entityName] = {
            tableName: metadata.tableName,
            columns: searchableColumns,
            relations: this.getSearchableRelations(metadata.relations)
          };
        }
      }

      return entities;
    } catch (error) {
      console.error('Entity discovery error:', error);
      return {};
    }
  }

  /**
   * Check if column is searchable
   */
  isSearchableColumn(column) {
    const name = column.propertyName.toLowerCase();

    // Exclude sensitive fields (exact match)
    if (this.sensitiveFields.includes(name)) {
      return false;
    }

    // Exclude sensitive-looking fields by substring too (e.g. "resetPasswordToken"),
    // not just fields that exactly match SENSITIVE_FIELDS
    const sensitivePatterns = ['password', 'hash', 'token', 'key', 'secret', 'private'];
    if (sensitivePatterns.some(pattern => name.includes(pattern))) {
      return false;
    }

    // Only genuinely text-typed columns are searchable with LOWER()/LIKE. A
    // column's name alone is never sufficient - non-text types (uuid, timestamp,
    // date, integer, boolean, enum) fail at query time despite "looking" textual.
    return SEARCHABLE_COLUMN_TYPES.includes(column.type);
  }

  /**
   * Get column search weight for relevance ranking
   */
  getColumnWeight(columnName) {
    const lowerName = columnName.toLowerCase();
    return COLUMN_WEIGHTS[lowerName] || 1;
  }

  /**
   * Filter entities based on user role
   */
  filterEntitiesByRole(entities, userRole) {
    const filtered = {};

    for (const [entityName, entityData] of Object.entries(entities)) {
      const permissions = this.entityPermissions[entityName];

      if (permissions && permissions[userRole]) {
        const allowedColumns = permissions[userRole];

        filtered[entityName] = {
          ...entityData,
          columns: entityData.columns.filter(col =>
            allowedColumns.includes(col.name) || allowedColumns.includes('*')
          )
        };
      } else if (userRole === 'admin') {
        // Admins can search most entities by default
        filtered[entityName] = entityData;
      }
    }

    return filtered;
  }

  /**
   * Perform contextual search across entities.
   *
   * `filters.category` (an entity name, case-insensitive) scopes the search to a
   * single entity instead of every entity the role can access - used by callers
   * like doctor search or product search that only ever want one entity type.
   */
  async performContextualSearch(query, entities, userId, userRole, filters) {
    const results = {};
    const searchPromises = [];

    const entriesToSearch = filters.category
      ? Object.entries(entities).filter(
          ([entityName]) => entityName.toLowerCase() === String(filters.category).toLowerCase()
        )
      : Object.entries(entities);

    for (const [entityName, entityData] of entriesToSearch) {
      const promise = this.searchEntity(
        entityName,
        entityData,
        query,
        userId,
        userRole,
        filters
      ).then(entityResults => {
        if (entityResults.length > 0) {
          results[entityName.toLowerCase()] = entityResults;
        }
      });

      searchPromises.push(promise);
    }

    await Promise.all(searchPromises);
    return results;
  }

  /**
   * Search specific entity with user context
   */
  async searchEntity(entityName, entityData, query, userId, userRole, filters) {
    try {
      const repository = AppDataSource.getRepository(entityName);
      const queryBuilder = repository.createQueryBuilder('entity');

      // Apply user-specific filters
      this.applyUserFilters(queryBuilder, entityName, userId, userRole);

      // Apply search conditions
      this.applySearchConditions(queryBuilder, entityData.columns, query);

      // Apply additional filters
      this.applyAdditionalFilters(queryBuilder, filters);

      // Apply ordering by relevance
      this.applyRelevanceOrdering(queryBuilder, entityData.columns, query);

      // Limit results per entity
      queryBuilder.limit(SEARCH_SETTINGS.MAX_RESULTS_PER_ENTITY);

      const results = await queryBuilder.getMany();

      // Clean sensitive data and add metadata
      return results.map(result => this.cleanAndEnhanceResult(result, entityName, userRole));

    } catch (error) {
      console.error(`Error searching ${entityName}:`, error);
      return [];
    }
  }

  /**
   * Apply user-specific filters based on role and ownership
   */
  applyUserFilters(queryBuilder, entityName, userId, userRole) {
    const userFilters = USER_FILTERS[userRole] || {};
    const entityFilters = userFilters[entityName];

    if (entityFilters) {
      if (entityFilters === 'CUSTOM_FUNCTION') {
        // Handle custom functions (like doctor seeing their patients)
        this.applyCustomUserFilter(queryBuilder, entityName, userId, userRole);
      } else {
        Object.entries(entityFilters).forEach(([field, value]) => {
          if (value === 'USER_ID') {
            queryBuilder.andWhere(`entity.${field} = :userId`, { userId });
          } else {
            queryBuilder.andWhere(`entity.${field} = :${field}`, { [field]: value });
          }
        });
      }
    }
  }

  /**
   * Apply custom user filters for complex cases
   */
  applyCustomUserFilter(queryBuilder, entityName, userId, userRole) {
    if (userRole === 'doctor' && entityName === 'User') {
      // Doctors can see patients they've treated
      queryBuilder.andWhere(`entity.id IN (
        SELECT DISTINCT patientId FROM transactions 
        WHERE doctorId = :doctorId
      )`, { doctorId: userId });
    }
  }

  /**
   * Apply search conditions to query.
   *
   * Tokenizes the query into individual words and requires every word to match
   * at least one searchable column (AND across words, OR across columns), so a
   * query like "john cardiologist" can match name and specialty in separate
   * columns instead of only matching if the whole phrase appears in one column.
   */
  applySearchConditions(queryBuilder, columns, query) {
    if (!columns || columns.length === 0) return;

    const terms = query.split(/\s+/).filter(Boolean).slice(0, 10);
    if (terms.length === 0) return;

    const parameters = {};
    const termGroups = terms.map((term, termIndex) => {
      const columnConditions = columns.map((column, colIndex) => {
        const paramName = `search_${termIndex}_${colIndex}`;

        if (column.type && column.type.includes('array')) {
          // Parameterized ANY() match - avoids injecting the term directly into SQL
          parameters[paramName] = term;
          return `:${paramName} = ANY(entity.${column.name})`;
        }

        parameters[paramName] = `%${term}%`;
        return `LOWER(entity.${column.name}) LIKE LOWER(:${paramName})`;
      });

      return `(${columnConditions.join(' OR ')})`;
    });

    queryBuilder.andWhere(termGroups.join(' AND '), parameters);
  }

  /**
   * Apply relevance-based ordering
   */
  applyRelevanceOrdering(queryBuilder, columns, query) {
    // 🔧 FIX: Check if columns array is empty
    if (!columns || columns.length === 0) {
      // No searchable columns, use simple ordering without relevance score
      try {
        // Try common timestamp column names
        const possibleTimeColumns = ['createdAt', 'created_at', 'updatedAt', 'updated_at', 'timestamp', 'changedAt', 'accessed_at'];

        // Get entity metadata to find actual column names
        const entityMetadata = queryBuilder.expressionMap.mainAlias.metadata;
        const actualColumns = entityMetadata.columns.map(col => col.propertyName);

        // Find the first matching timestamp column
        const timeColumn = possibleTimeColumns.find(col => actualColumns.includes(col));

        if (timeColumn) {
          queryBuilder.orderBy(`entity.${timeColumn}`, 'DESC');
        }
      } catch (error) {
        // Fallback: skip ordering if column detection fails
        console.warn('Could not determine timestamp column for ordering:', error.message);
      }
      return;
    }

    // Bind the query as parameters rather than interpolating it into the SQL text.
    // TypeORM tracks parameters on the query builder globally, so a param set here
    // is available to the raw SQL fragment passed to addSelect below.
    const lowerQuery = query.toLowerCase();
    queryBuilder.setParameter('relevanceExact', lowerQuery);
    queryBuilder.setParameter('relevancePrefix', `${lowerQuery}%`);
    queryBuilder.setParameter('relevanceContains', `%${lowerQuery}%`);

    const orderCases = columns.map(column => {
      const weight = column.weight;
      return `CASE
        WHEN LOWER(entity.${column.name}) = :relevanceExact THEN ${weight * 3}
        WHEN LOWER(entity.${column.name}) LIKE :relevancePrefix THEN ${weight * 2}
        WHEN LOWER(entity.${column.name}) LIKE :relevanceContains THEN ${weight}
        ELSE 0
      END`;
    }).join(' + ');

    queryBuilder.addSelect(`(${orderCases})`, 'relevance_score');
    queryBuilder.orderBy('relevance_score', 'DESC');

    // 🔧 FIX: Use proper column name detection for ordering
    try {
      // Try common timestamp column names
      const possibleTimeColumns = ['createdAt', 'created_at', 'updatedAt', 'updated_at', 'timestamp', 'changedAt', 'accessed_at'];

      // Get entity metadata to find actual column names
      const entityMetadata = queryBuilder.expressionMap.mainAlias.metadata;
      const actualColumns = entityMetadata.columns.map(col => col.propertyName);

      // Find the first matching timestamp column
      const timeColumn = possibleTimeColumns.find(col => actualColumns.includes(col));

      if (timeColumn) {
        queryBuilder.addOrderBy(`entity.${timeColumn}`, 'DESC');
      }
    } catch (error) {
      // Fallback: don't add secondary ordering if column detection fails
      console.warn('Could not determine timestamp column for ordering:', error.message);
    }
  }

  /**
   * Clean result and add metadata
   */
  cleanAndEnhanceResult(result, entityName, userRole) {
    // Remove sensitive fields
    const cleaned = { ...result };
    this.sensitiveFields.forEach(field => {
      delete cleaned[field];
    });

    // Enforce field-level visibility. entityData.columns (used earlier for search
    // matching) is a narrower, text-only list - it does NOT limit what a raw
    // TypeORM getMany() row contains, which is every column on the entity. This is
    // the actual visibility control: project down to exactly what ENTITY_PERMISSIONS
    // grants this role for this entity, so a restricted role (e.g. "public") never
    // gets internal/non-permitted fields just because they weren't part of the
    // search-matching column set.
    const allowedFields = this.entityPermissions[entityName]?.[userRole];
    if (allowedFields && !allowedFields.includes('*')) {
      Object.keys(cleaned).forEach(key => {
        if (key !== 'id' && !allowedFields.includes(key)) {
          delete cleaned[key];
        }
      });
    }

    // Add metadata
    cleaned._meta = {
      entityType: entityName,
      searchable: true,
      updatedAt: result.updatedAt || result.createdAt
    };

    return cleaned;
  }

  /**
   * Generate search suggestions
   */
  /**
   * Generate search suggestions
   */
  async generateSuggestions(query, userRole) {
    try {
      const suggestions = [];
      const lowerQuery = query.toLowerCase();

      // 🔧 DYNAMIC FIX: Get terms from config but enhance them
      const baseTerms = COMMON_SEARCH_TERMS[userRole] || COMMON_SEARCH_TERMS.admin;
      const enhancedTerms = [...baseTerms, 'doc', 'docs', 'doctor', 'doctors', 'patient', 'patients', 'appointment', 'appointments'];

      const matches = enhancedTerms.filter(term =>
        term.toLowerCase().includes(lowerQuery) &&
        term.toLowerCase() !== lowerQuery
      );

      return [...new Set(matches)].slice(0, SEARCH_SETTINGS.MAX_SUGGESTIONS);
    } catch (error) {
      console.error('Suggestion generation error:', error);
      return [];
    }
  }

  /**f
   * Log search for analytics (anonymized)
   */
  // async logSearch(query, userRole) {
  //   try {
  //     // Only log non-sensitive search terms
  //     if (query.length < SEARCH_SETTINGS.MAX_QUERY_LENGTH && !this.containsSensitiveInfo(query)) {
  //       const searchLog = AppDataSource.getRepository('SearchLog');
  //       await searchLog.save({
  //         query: query.toLowerCase(),
  //         userRole,
  //         timestamp: new Date(),
  //         // Don't store user ID for privacy
  //       });
  //     }
  //   } catch (error) {
  //     // Fail silently - logging shouldn't break search
  //     console.error('Search logging error:', error);
  //   }
  // }

  /**
 * Log search for analytics (disabled until SearchLog entity is created)
 */
  async logSearch(query, userRole) {
    // 🔧 TEMP FIX: Disable logging until SearchLog entity is properly set up
    return; // Skip logging for now

    // Original logging code (commented out)
    /*
    try {
      if (query.length < SEARCH_SETTINGS.MAX_QUERY_LENGTH && !this.containsSensitiveInfo(query)) {
        const searchLogRepo = AppDataSource.getRepository('SearchLog');
        await searchLogRepo.save({
          query: query.toLowerCase(),
          userRole,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.warn('Search logging failed (non-critical):', error.message);
    }
    */
  }

  /**
   * Sanitize search query
   */
  sanitizeQuery(query) {
    // Remove special characters that could cause SQL injection
    return query.replace(/[<>;"']/g, '').trim();
  }

  /**
   * Check if query contains sensitive information
   */
  containsSensitiveInfo(query) {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(query));
  }

  /**
   * Calculate total results across all categories
   */
  calculateTotalResults(results) {
    return Object.values(results).reduce((total, categoryResults) =>
      total + (Array.isArray(categoryResults) ? categoryResults.length : 0), 0
    );
  }

  /**
   * Get searchable relations for entity
   */
  getSearchableRelations(relations) {
    // For now, keep it simple - can be enhanced later
    return relations.filter(relation =>
      !this.sensitiveEntities.includes(relation.type)
    ).map(relation => ({
      name: relation.propertyName,
      type: relation.type
    }));
  }

  /**
   * Apply additional filters from request.
   *
   * `key` comes straight from request query params, so it must be checked against
   * the entity's real column names before being used as a raw SQL identifier -
   * otherwise a crafted param name lets an attacker inject arbitrary SQL here.
   */
  applyAdditionalFilters(queryBuilder, filters) {
    const excludedParams = ['q', 'query', 'category', 'limit', 'offset', 'page'];

    let validColumns;
    try {
      validColumns = queryBuilder.expressionMap.mainAlias.metadata.columns.map(
        col => col.propertyName
      );
    } catch (error) {
      console.warn('Could not resolve entity metadata for additional filters:', error.message);
      return;
    }

    Object.entries(filters).forEach(([key, value], index) => {
      if (excludedParams.includes(key) || value === undefined || value === null || value === '') {
        return;
      }

      if (!validColumns.includes(key)) {
        console.warn(`Skipping filter for non-existent column: ${key}`);
        return;
      }

      const paramName = `filter_${index}`;
      queryBuilder.andWhere(`entity.${key} = :${paramName}`, { [paramName]: value });
    });
  }
}

module.exports = new SearchService();