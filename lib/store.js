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

    wrapRecord : function (record, factory) {

        var controller;

        if (factory.recordController) {
            controller = this.container.lookupFactory('controller:' + this.getCollection(factory).get('itemController'));

            if (controller) {
                controller = controller.create({model: record});
            }

            else {
                controller = null;
            }
        }

        return controller || record;
    },

    findInCache : function (model, id, doWrap) {

        var cache,
            factory;

        factory = this.modelFor(model);
        cache = this.__cache[factory.collectionKey] = this.__cache[factory.collectionKey] || {};

        if (doWrap === false) {
            return cache[id];
        }

        return cache[id] ? this.wrapRecord(cache[id], factory) : null;
    },

    findInCacheOrCreate : function (model, id, doWrap) {

        var record,
            factory;

        factory = this.modelFor(model);

        if (id) {
            record = this.findInCache(model, id, doWrap);
        }

        if (!record) {
            record = factory.create();
            record.set('pk', id);
            this.add(factory, record);

            if (!doWrap === false) {
                record = this.wrapRecord(record, factory);
            }
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
            collection,
            collectionFactory;

        factory = this.modelFor(model);

        if (!factory) {
            throw new Ember.Error('No model was found for "' + model + '"');
        }

        collectionFactory = this.container.lookupFactory('collection:models.' + (model.__emberName || model));
        collection = (collectionFactory || DF.Collection).create({container : this.container, store: this, model : Ember.A()});

        if (factory.recordController) {
            collection.set('itemController', factory.recordController);
        }

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

    controllerFor : function (key) {

        var factory;

        factory = this.getCollection(key);
        key = factory.get('itemController');

        factory = this.container.lookupFactory(this.container.normalize('controller:' + key));

        if (factory) {
            return factory.create({container : this.container, store: this});
        }

        return null;
    },

    registerModel : function (key) {

        var factory = this.modelFor(key);

        this.__registry[factory.typeKey] = factory;
        this.__registry[factory.collectionKey] = factory;

        factory.__emberName = key;

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

    filter : function (model, q) {

        var collection,
            filtered;

        collection = this.getCollection(model);
        filtered = this.createCollection(model);

        filtered.arrayDidChange = function () {

            var content;

            content = collection.get('content').filter(function (item, index) {

                var p,
                    doesMatch;

                doesMatch = true;

                for (p in q) {
                    if (item.get(p) !== q[p]) {
                        doesMatch = false;
                    }
                }

                return doesMatch;

            });

            this.set('content', content);
        };

        collection.addObserver('content.@each', filtered.arrayDidChange.bind(filtered));
        filtered.arrayDidChange();

        return filtered;
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

        return factory.adapter.fetch(factory, q).then(function (json) {

            json = json[factory.typeKey] || json;
            json = Ember.isArray(json) ? json[0] : json;

            record = this.findInCacheOrCreate(model, json[factory.primaryKey]);
            record.deserialize(json);

            return this.wrapRecord(record, factory);

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

        return factory.adapter.fetchAll(factory).then(function (json) {

            json = json[factory.collectionKey] || json;
            json = Ember.isArray(json) ? json : [json];

            for (i = 0; i < json.length; i ++) {
                item = json[i];
                record = this.findInCacheOrCreate(model, item[factory.primaryKey]);
                record.deserialize(item);
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
                record = this.findInCacheOrCreate(factory, item[factory.primaryKey], false);
                record.deserialize(item);
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