DF.Store = Ember.Object.extend({

    init : function () {

        this.clear();

        return this._super.apply(this, arguments);
    },

    clear : function () {
        this.__cache = {};
        this.__registry = {};
        this.__store = {};
    },

    getTypeKey : function (key) {
        key = key.split('.');
        key = key[key.length - 1];
        key = key.charAt(0).toLowerCase() + key.slice(1);
        return key;
    },

    addToCache : function (model, records) {

        var i,
            pk,
            cache,
            record,
            factory;

        factory = this.modelFor(model);
        cache = this.__cache[factory.collectionKey] = this.__cache[factory.collectionKey] || {};

        for (i = 0; i < records.length; i ++) {

            record = records[i];
            pk = record.get('pk');

            if (pk !== null && typeof pk !== 'undefined') {
                cache[pk] = record;
            }
        }

        return cache;
    },

    removeFromCache : function (model, records) {

        var i,
            pk,
            cache,
            record,
            factory;

        factory = this.modelFor(model);
        cache = this.__cache[factory.collectionKey] = this.__cache[factory.collectionKey] || {};

        for (i = 0; i < records.length; i ++) {

            record = records[i];
            pk = record.get('pk');

            cache[pk] = null;
        }

        return cache;
    },

    findInCache : function (model, id) {

        var cache,
            factory;

        factory = this.modelFor(model);
        cache = this.__cache[factory.collectionKey] = this.__cache[factory.collectionKey] || {};
        return cache[id];
    },

    findInCacheOrCreate : function (model, id, data) {

        var record,
            factory;

        factory = this.modelFor(model);

        if (id) {
            record = this.findInCache(model, id);
            if (data && record) {
                record.deserialize(data);
            }
        }

        if (!record) {
            record = factory.create();
            data && record.deserialize(data);
            record.set('pk', id);
            this.add(factory, record);
        }

        return record;
    },

    getCollection : function (model) {

        var factory,
            collection;

        factory = this.modelFor(model);

        if (!factory) {
            throw new Ember.Error('No model was found for "' + model + '"');
        }

        collection = this.__store[factory.collectionKey];

        if (!collection) {
            collection = this.__store[factory.collectionKey] = this.createCollection(model);
        }

        return collection;
    },

    createCollection : function (model) {

        var factory,
            collection;

        factory = this.modelFor(model);

        if (!factory) {
            throw new Ember.Error('No model was found for "' + model + '"');
        }

        collection = DF.Collection.create({content : Ember.A()});

        collection.set('factory', factory);
        collection.set('primaryKey', factory.primaryKey);
        collection.set('typeKey', factory.typeKey);
        collection.set('collectionKey', factory.collectionKey);

        return collection;
    },

    modelFor : function (key) {

        var factory,
            typeKey,
            normalizedKey;

        factory = typeof key !== 'string' ? key : null;

        if (!factory) {
            factory = this.__registry[key];
        }

        if (!factory) {

            normalizedKey = this.container.normalize('model:' + key);
            typeKey = this.getTypeKey(key);

            factory = this.container.lookupFactory(normalizedKey);

            if (factory) {
                factory.typeKey = factory.typeKey || typeKey;
                factory.collectionKey = factory.collectionKey || factory.typeKey + 's';
            }
        }

        if (factory) {
            factory.store = factory.prototype.store = this;
        }

        return factory;
    },

    registerModel : function (key) {

        var factory = this.modelFor(key);

        this.__registry[factory.typeKey] = factory;
        this.__registry[factory.collectionKey] = factory;

        return factory;
    },

    find : function (model, q) {

        var collection;

        collection = this.getCollection(model);

        if (typeof q === 'number' || typeof q === 'string') {
            return this.findInCache(model, q);
        }

        return collection.find(function (item, index, collection) {

            var p,
                doesMatch;

            doesMatch = true;

            for (p in q) {
                if (item.get(p) !== q[p]) {
                    doesMatch = false;
                }
            }

            return doesMatch;

        }, this);
    },

    filter : function (model, q, props) {

        var i,
            p,
            props,
            collection;

        collection = this.getCollection(model);
        props = props ? props.concat() : [];

        if (typeof q === 'object') {
            for (p in q) {
                props.push('content.@each.' + p);
            }
        }
        else if (typeof q === 'function') {
            props.push('content.length');
        }

        return DF.Collection.extend({

            model : Ember.A(),

            init : function () {

                this.arrayDidChange = this.arrayDidChange.bind(this);

                for (i = 0; i < props.length; i ++) {
                    collection.addObserver(props[i], this.arrayDidChange);
                }

                this.arrayDidChange();

                return this._super.apply(this, arguments);
            },

            arrayDidChange : function () {

                var model;

                model = collection.get('model').filter(function (item, index) {

                    var doesMatch = true;

                    if (!q) {
                        return doesMatch;
                    }

                    if (typeof q === 'object') {
                        for (p in q) {
                            if (item.get(p) !== q[p]) {
                                doesMatch = false;
                            }
                        }
                    }
                    else if (typeof q === 'function') {
                        doesMatch = q.apply(this, [item]);
                    }

                    return doesMatch;

                });

                this.set('model', model);

            },

            destroy : function () {
                for (i = 0; i < props.length; i ++) {
                    collection.removeObserver(props[i], this.arrayDidChange);
                }

                return this._super.apply(this, arguments);
            }

        }).create();
    },

    all : function (model) {
        return this.getCollection(model);
    },

    fetchUnloadedRecords : function () {

        var p,
            i,
            r;

        for (p in this.__cache) {
            for (i in this.__cache[p]) {
                r = this.__cache[p][i];
                if (!r.get('isLoaded')) {
                    r.fetchRecord();
                }
            }
        };
    },

    fetch : function (model, q) {

        var record,
            factory;

        factory = this.modelFor(model);

        return factory.prototype.adapter.fetch(factory, q).then(function (json) {

            json = json[factory.typeKey] || json;
            json = Ember.isArray(json) ? json[0] : json;

            record = this.findInCacheOrCreate(model, json[factory.primaryKey], json);

            return record;

        }.bind(this));
    },

    fetchAll : function (model) {

        var i,
            item,
            record,
            records,
            factory,
            collection;

        records = [];
        factory = this.modelFor(model);

        return factory.prototype.adapter.fetchAll(factory).then(function (json) {

            json = json[factory.collectionKey] || json;
            json = Ember.isArray(json) ? json : [json];

            for (i = 0; i < json.length; i ++) {
                item = json[i];
                record = this.findInCacheOrCreate(model, item[factory.primaryKey], item);
                records.push(record);
            }

            return this.all(model);

        }.bind(this));
    },

    add : function (model, records) {

        var i,
            pk,
            record;

        if (model instanceof DF.Model || model instanceof DF.Collection) {
            records = model;
            model = model.factory || model.constructor;
        }

        records = Ember.isArray(records) ? records : [records];

        for (i = 0; i < records.length; i ++) {
            record = records[i];
            if (record.get('pk')) {
                if (this.findInCache(model, record.get('pk'))) {
                    records.splice(i, 1);
                    i --;
                }
            }
        }

        this.addToCache(model, records);
        return this.getCollection(model).pushObjects(records);
    },

    remove : function (model, records) {

        if (model instanceof DF.Model || model instanceof DF.Collection) {
            records = model;
            model = model.factory || model.constructor;
        }

        records = Ember.isArray(records) ? records : [records];
        this.removeFromCache(model, records);
        this.getCollection(model).removeObjects(records);
    },

    injectType : function (type, data) {

        var i,
            item,
            record,
            factory;

        factory = this.modelFor(type);
        data = Ember.isArray(data) ? data : [data];

        for (i = 0; i < data.length; i ++) {
            item = data[i];
            if (item) {
                record = this.findInCacheOrCreate(factory, item[factory.primaryKey], item);
            }
        }
    },

    inject : function (type, data) {

        var p;

        if (typeof type === 'object') {
            data = type;
            type = null;
        }

        if (type) {
            return this.injectType(type, data);
        }

        for (p in data) {
            if (this.__registry[p]) {
                this.injectType(p, data[p]);
            }
        }

        Ember.run.next(this, this.fetchUnloadedRecords);
    }

});