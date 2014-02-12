;(function (global) {

"use strict";

var DF = global.DF = Ember.Namespace.create({
    VERSION : '0.0.1'
});

DF.required = function (message) {
    return function () {
        var className = this.constructor.toString();
        throw new Error(message.replace('{{className}}', className));
    };
};

DF.Adapter = Ember.Object.extend({

    find : function (model, q) {
        return this.store.find(model, q);
    },

    all : function (model) {
        return this.store.all(model);
    },

    saveRecord : function (model) {

        if (model.get('isNew')) {
            return this.createRecord(model);
        }

        return this.updateRecord(model);
    },

    fetch : DF.required('{{className}} must implement the `fetch()` method'),
    fetchAll : DF.required('{{className}} must implement the `fetchAll()` method'),
    createRecord : DF.required('{{className}} must implement the `createRecord()` method'),
    updateRecord : DF.required('{{className}} must implement the `updateRecord()` method'),
    deleteRecord : DF.required('{{className}} must implement the `deleteRecord()` method')
});

DF.RESTAdapter = DF.Adapter.extend({

    host : '',
    prefix : '',

    ajaxOptions : function (url, method) {

        return {
            url : url,
            type : method,
            contentType : "application/json",
            dataType : "json"
        };
    },

    ajax : function (url, data, method, options) {

        options = options || this.ajaxOptions(url, method);

        data = data || {};

        return new Ember.RSVP.Promise(function (resolve, reject) {

            if (method === "GET") {
                options.data = data;
            }

            else {
                options.data = JSON.stringify(data);
            }

            options.success = function (json) {
                Ember.run(null, resolve, json);
            };

            options.error = function(jqXHR, textStatus, errorThrown) {
                if (jqXHR) {
                    jqXHR.then = null;
                }

                Ember.run(null, reject, jqXHR);
            };


            Ember.$.ajax(options);
        });
    },

    httpGet : function (url, data) {
        return this.ajax(url, data, 'GET');
    },

    httpPost : function (url, data) {
        return this.ajax(url, data, 'POST');
    },

    httpPut : function (url, data) {
        return this.ajax(url, data, 'PUT');
    },

    httpDelete : function (url, data) {
        return this.ajax(url, data, 'DELETE');
    },

    getURL : function (factory, id) {

        var url;

        url = [this.get('host'), this.get('prefix')];

        url.push(factory.url || factory.typeKey);

        if (id) {
            url.push(id);
        }

        return url.join('/').replace(/([^:]\/)\/+/g, "$1");
    },

    fetch : function (factory, id) {
        return this.httpGet(
            this.getURL(factory, id)
        );
    },

    fetchAll : function (factory) {
        return this.httpGet(
            this.getURL(factory)
        );
    },

    createRecord : function (record) {
        return this.httpPost(
            this.getURL(record.constructor),
            record.serialize()
        );
    },

    updateRecord : function (record) {
        return this.httpPut(
            this.getURL(record.constructor, record.get('pk')),
            record.serialize()
        );
    },

    deleteRecord : function (record) {
        return this.httpDelete(
            this.getURL(record.constructor, record.get('pk'))
        );
    }
});

DF.Collection = Ember.ArrayProxy.extend(Ember.Evented, {

    factory : null,
    primaryKey : null,

    typeKey : null,
    collectionKey : null,

    findByPrimaryKey : function (q) {
        return this.findBy(this.primaryKey, q);
    },

    removeByPrimaryKey : function () {
        return this.remove(this.findBy(this.primaryKey, q));
    },

    remove : function (obj) {
        return this.removeObject(obj);
    },

    removeObject : function (obj) {

        var index,
            content;

        content = this.get('content');
        index = content.indexOf(obj);

        if (index < 0) {
            return false;
        }

        obj.removed = true;

        this.arrayContentWillChange(index, 1, 0);
        content.splice(index, 1);
        this.arrayContentDidChange(index, 1, 0);

        return true;
    },

    toString : function () {
        return ('collection:' + this.collectionKey);
    },

    serialize : function (isEmbedded) {

        var a = [];

        this.forEach(function (item, index, collection) {

            if (isEmbedded) {
                a.push(item.serialize());
            }

            else {
                a.push(item.get('pk'));
            }

        }, this);

        return a;
    }

});

DF.Model = Ember.Object.extend({

    primaryKey : 'id',

    url : null,
    adapter : DF.RESTAdapter.create(),

    typeKey : null,
    collectionKey : null,

    __data : null,
    __dirtyAttributes : null,

    __currentPromise : null,

    __isSaving : false,
    __isDirty : false,
    __isLoaded : false,
    __isDeleting : false,
    __isDeleted : false,

    didDefineProperty : function (proto, key, val) {

        var meta,
            protoConstructor;

        protoConstructor = proto.constructor;

        if (val instanceof Ember.Descriptor) {

            meta = val.meta();
            meta.key = key;

            if (meta.isAttribute) {

                if (!protoConstructor.__attributes) {
                    protoConstructor.__attributes = [];
                }

                protoConstructor.__attributes.push(key);

            }

            else if (meta.isRelationship) {

                if (!protoConstructor.__relationships) {
                    protoConstructor.__relationships = [];
                }

                protoConstructor.__relationships.push(key);
            }
        }
    },

    pk : function (key, val) {

        if (!this.primaryKey) {
            return null;
        }

        if (val !== undefined) {
            this.set(this.primaryKey, val);
        }

        return this.get(this.primaryKey);

    }.property(),

    getAttributes : function () {
        return this.constructor.getAttributes();
    },

    getRelationships : function () {
        return this.constructor.getRelationships();
    },

    isValid : function () {
        return this.validate();
    }.property(),

    isNew : function () {
        return !this.get('pk');
    }.property(),

    isLoaded : function () {
        return this.get('__isLoaded');
    }.property('__isLoaded'),

    isLoading : function () {
        return !this.get('__isLoaded');
    }.property('__isLoaded'),

    isDeleted : function () {
        return this.get('__isDeleted');
    }.property('__isDeleted'),

    isDirty : function () {
        return this.get('__isDirty');
    }.property('__isDirty'),

    isClean : function () {
        return !this.isDirty();
    }.property('__isDirty'),

    serialize : function (isNested) {

        var p,
            pk,
            key,
            meta,
            json,
            nestedJson,
            attributes,
            properties,
            relationships;

        pk = this.get('pk');
        json = {};
        attributes = this.getAttributes();
        relationships = this.getRelationships();

        properties = this.getProperties(attributes.concat(relationships));

        for (p in properties) {

            meta = this.constructor.metaForProperty(p);
            key = meta.options.key || p;

            json[key] = meta.serialize.call(this);
        }

        if (this.primaryKey) {
            json[this.primaryKey] = pk;
        }

        if (isNested) {
            nestedJson = json;
            json = {};
            json[this.typeKey] = nestedJson;
        }

        return json;
    },

    deserialize : function (json) {

        var p,
            pk,
            key,
            meta,
            item,
            data,
            jsonItem,
            attributes,
            properties,
            relationships;

        data = {};
        attributes = this.getAttributes();
        relationships = this.getRelationships();

        properties = this.getProperties(attributes.concat(relationships));

        pk = this.get('pk');

        for (p in properties) {

            meta = this.constructor.metaForProperty(p);
            key = meta.options.key || p;

            jsonItem = json[key];

            if (typeof jsonItem !== 'undefined') {
                data[meta.key] = jsonItem === null ? null : meta.deserialize.call(this, jsonItem);
            }
        }

        if (this.primaryKey) {
            this.set('pk', json[this.primaryKey] || null);
        }

        this.set('__data', data);
        this.set('__isLoaded', true);
        this.set('__isDirty', false);
    },

    validate : function () {
        return true;
    },

    merge : function (data) {
        this.deserialize(data instanceof DF.Model ? data.deserialize() : data);
    },

    save : function () {
        return this.saveRecord();
    },

    fetch : function () {
        return this.fetchRecord();
    },

    fetchRecord : function () {

        this.set('__isLoaded', false);

        if (this.__currentPromise) {
            if (this.__currentPromise._state !== 1 && this.__currentPromise._state !== 2) {
                return this.__currentPromise = this.__currentPromise.then(this.fetchRecord.bind(this));
            }
        }

        return this.__currentPromise = this.adapter.fetch(this.constructor, this.get('pk')).then(function (json) {

            json = json[this.typeKey] || json;
            json = Ember.isArray(json) ? json[0] : json;

            this.deserialize(json);

        }.bind(this));
    },

    saveRecord : function () {

        if (this.get('isValid')) {

            if (this.__currentPromise) {
                if (this.__currentPromise._state !== 1 && this.__currentPromise._state !== 2) {
                    return this.__currentPromise = this.__currentPromise.then(this.saveRecord.bind(this));
                }
            }

            this.set('__isDirty', false);

            return this.__currentPromise = this.adapter.saveRecord(this).then(function (json) {

                var isNew = this.get('isNew');

                json = json[this.typeKey] || json;
                json = Ember.isArray(json) ? json[0] : json;

                this.deserialize(json);

                if (isNew) {
                    this.store.add(this);
                }

                this.set('__isSaving', false);

            }.bind(this));
        }

        else {
            return new Ember.RSVP.Promise(function (resolve, reject) {
                reject(new Error('Tried to save an invalid record.'));
            });
        }
    },

    deleteRecord : function () {

        this.set('__isDeleting', true);

        if (this.__currentPromise) {
            if (this.__currentPromise._state !== 1 && this.__currentPromise._state !== 2) {
                return this.__currentPromise = this.__currentPromise.then(this.deleteRecord.bind(this));
            }
        }

        return this.__currentPromise = this.adapter.deleteRecord(this).then(function (json) {

            this.store.remove(this);

            this.set('__isDeleting', false);
            this.set('__isDeleted', true);

            this.destroy();

        }.bind(this));
    },

    clone : function () {

        var copy,
            data;

        data = this.get('__data') || {};

        copy = this.constructor.create();
        copy.set('__data', data);
        copy.set('pk', null);

        copy.set('__isLoaded', true);
        copy.set('__isDirty', false);

        return copy;
    },

    revert : function () {
        this.merge(this.__original);
        this.__original.destroy();
        this.__original = null;
        this.__dirtyAttributes = null;
        this.set('__isDirty', false);
    }
});

DF.Model.reopenClass({

    getAttributes : function (a) {

        this.proto();
        a = this.__attributes || [];

        if (typeof this.superclass.getAttributes === 'function') {
            a = this.superclass.getAttributes().concat(a);
        }

        return a;
    },

    getRelationships : function (a) {

        this.proto();
        a = this.__relationships || [];

        if (typeof this.superclass.getRelationships === 'function') {
            a = this.superclass.getRelationships().concat(a);
        }

        return a;
    },

    extend : function () {

        var i,
            r,
            d,
            p,
            props,
            classProps;

        d = {};
        r = this._super.apply(this, arguments);
        classProps = ['primaryKey', 'url', 'adapter', 'typeKey', 'collectionKey'];

        props = [].slice.apply(arguments, [-1])[0];

        for (i = 0; i < classProps.length; i ++) {

            p = props[classProps[i]];

            if (p) {
                d[classProps[i]] = p;
            }
        }

        r.reopenClass(d);

        return r;
    }
});

DF.Store = Ember.Object.extend({

    init : function () {

        this.__cache = {};
        this.__registry = {};
        this.__store = {};

        return this._super.apply(this, arguments);
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

            cache[pk] = record;
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

    findInCacheOrCreate : function (model, id) {

        var record,
            factory;

        factory = this.modelFor(model);

        if (id) {
            record = this.findInCache(model, id);
        }

        if (!record) {
            record = factory.create();
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
            collection = this.__store[factory.collectionKey] = DF.Collection.create({content : Ember.A()});

            collection.set('factory', factory);
            collection.set('primaryKey', factory.primaryKey);
            collection.set('typeKey', factory.typeKey);
            collection.set('collectionKey', factory.collectionKey);
        }

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

        return collection.filter(function (item, index, collection) {

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

        return factory.adapter.fetchAll(factory).then(function (json) {

            json = json[factory.collectionKey] || json;
            json = Ember.isArray(json) ? json : [json];

            for (i = 0; i < json.length; i ++) {
                item = json[i];
                record = this.findInCacheOrCreate(model, item[factory.primaryKey]);
                record.deserialize(item);
                records.push(record);
            }

            collection = DF.Collection.create({content : records});
            return collection;

        }.bind(this));
    },

    add : function (model, records) {

        if (model instanceof DF.Model || model instanceof DF.Collection) {
            records = model;
            model = model.factory || model.constructor;
        }

        records = Ember.isArray(records) ? records : [records];
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
        return this.getCollection(model).removeObjects(records);
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
                record = this.findInCacheOrCreate(factory, item[factory.primaryKey]);
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

DF.attr = function (type, options) {

    if (typeof type === 'object') {
        type = 'string';
        options = type;
    }

    type = type || 'string';

    options = options || {};

    var attr = Ember.computed(function (key, val) {

        var data,
            oldVal;

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__original) {
                    this.__original = this.clone();
                }

                this.__changedAttributes = this.__changedAttributes || [];
                this.__changedAttributes.push(key);

                this.set('__isDirty', true);

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : null;
        }

        return val;

    }).property('__data');

    attr.meta({

        type : type,
        options : options,
        isAttribute : true,

        serialize : function () {
            var meta = attr.meta(),
                data = this.get('__data');

            return data ? data[meta.key] : null;
        },

        deserialize : function (val) {
            return val;
        }
    });

    return attr;
};

DF.belongsTo = function (factoryName, options) {

    var factory,
        belongsTo;

    options = options || {};

    belongsTo = Ember.computed(function (key, val) {

        var data,
            oldVal;

        factory = this.store.modelFor(factoryName);

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__original) {
                    this.__original = this.clone();
                }

                this.__changedAttributes = this.__changedAttributes || [];
                this.__changedAttributes.push(key);

                this.set('__isDirty', true);

                if (typeof val === 'string' || typeof val === 'number') {
                    val = this.store.findInCacheOrCreate(factoryName, val);
                }

                if (val) {
                    Ember.assert(
                        Ember.String.fmt('Attempted to set property of type: %@ with a value of type: %@',
                        [val.constructor, factoryName]),
                        val instanceof factory
                    );
                }

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : null;
        }

        return val;

    }).property('__data');

    belongsTo.meta({

        type : 'belongsTo',
        isRelationship : true,
        options : options,

        serialize : function () {

            var val,
                data,
                meta;

            data = this.get('__data');
            meta = belongsTo.meta();
            val = data ? data[meta.key] : null;

            if (val && val instanceof DF.Model) {

                if (options.embedded) {
                    return val.serialize();
                }

                return val.get('pk');
            }

            return val;
        },

        deserialize : function (val) {

            var meta,
                record;

            meta = belongsTo.meta();

            if (options.embedded && typeof val === 'object') {
                record = factory.create();
                record.deserialize(val);
            }

            else {
                record = this.store.findInCacheOrCreate(factoryName, val);
            }

            return record;
        }
    });

    return belongsTo;
};

DF.hasMany = function (factoryName, options) {

    var factory,
        hasMany;

    options = options || {};

    hasMany = Ember.computed(function (key, val) {

        var data,
            oldVal;

        factory = this.store.modelFor(factoryName);

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__original) {
                    this.__original = this.clone();
                }

                this.__changedAttributes = this.__changedAttributes || [];
                this.__changedAttributes.push(key);

                this.set('__isDirty', true);

                if (val) {

                    Ember.assert(
                        Ember.String.fmt('Attempted to set property of type: %@ with a value of type: %@',
                        [val.constructor, DF.Collection]),
                        val instanceof DF.Collection
                    );
                }

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : null;
        }

        return val;

    }).property('__data');

    hasMany.meta({

        type : 'hasMany',
        isRelationship : true,
        options : options,

        serialize : function () {

            var val,
                meta,
                data;

            data = this.get('__data');
            meta = hasMany.meta();
            val = data ? data[meta.key] : null;

            return val ? val.serialize(options.embedded) : null;
        },

        deserialize : function (val) {

            var i,
                meta,
                record,
                records,
                collection;

            meta = hasMany.meta();
            val = Ember.isArray(val) ? val : [val];
            records = [];

            collection = DF.Collection.create({content : Ember.A()});

            for (i = 0; i < val.length; i ++) {

                if (val[i]) {

                    if (options.embedded && typeof val[i] === 'object') {
                        record = factory.create();
                        record.deserialize(val[i]);
                    }

                    else {
                        record = this.store.findInCacheOrCreate(factoryName, val);
                    }

                    records.push(record);
                }
            }

            if (records.length) {
                collection.set('factory', factory);
                collection.set('primaryKey', factory.primaryKey);
                collection.set('typeKey', factory.typeKey);
                collection.set('collectionKey', factory.collectionKey);

                collection.pushObjects(records);
            }

            return collection;
        }
    });

    return hasMany;
};

Ember.Application.initializer({

    name : 'ez-data',

    initialize: function (container, app) {

        var p,
            store;

        store = DF.Store.create();
        store.set('app', app);
        store.set('container', container);

        app.store = store;

        app.register('store:main', store, {instantiate : false});

        app.inject('controller', 'store', 'store:main');
        app.inject('view', 'store', 'store:main');
        app.inject('route', 'store', 'store:main');

        for (p in container.registry.dict) {
            if (p.indexOf('model:') > -1) {
                store.registerModel(p.split(':', 2)[1]);
            }
        }
    }
});

})(this);