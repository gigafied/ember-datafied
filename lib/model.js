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
    __isFetching : false,
    __isLoaded : false,
    __isDeleting : false,
    __isDeleted : false,

    init : function () {

        var i,
            meta,
            attributes;

        attributes = this.getAttributes();

        for (i = 0; i < attributes.length; i ++) {

            meta = this.constructor.metaForProperty(attributes[i]);

            if (meta.options && typeof meta.options.defaultValue !== 'undefined') {
                this.set(meta.key, meta.options.defaultValue);
            }

        }

        this.set('dirtyAttributes', []);

        return this._super.apply(this, arguments);
    },

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

    dirtyAttributes : function (key, val) {

        if (arguments.length === 2) {
            val = val || [];
            this.__dirtyAttributes = val;
        }

        else {
            val = this.__dirtyAttributes;
        }

        return val || [];

    }.property(),

    hasDirtyAttributes : function () {
        var da = this.get('dirtyAttributes');
        return da && !!da.length;
    }.property('dirtyAttributes'),

    isClean : function () {
        return !this.get('isDirty');
    }.property('isDirty'),

    isValid : function () {
        return this.validate();
    }.property(),

    isNew : function () {
        return this.primaryKey ? !this.get('pk') : false;
    }.property('pk'),

    isLoaded : function () {
        return this.get('isNew') || this.get('__isLoaded');
    }.property('__isLoaded'),

    isLoading : function () {
        return !this.get('__isLoaded');
    }.property('__isLoaded'),

    isDeleted : function () {
        return this.get('__isDeleted');
    }.property('__isDeleted'),

    serialize : function (isNested) {

        var a,
            p,
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

            a = key.split('.');

            while (a.length) {
                json[a[0]] = json[a[0]] || {};
                a.splice(0, 1);
            }

            Ember.set(json, key, meta.serialize.call(this));
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

    deserialize : function (json, skipDirty) {

        var i,
            p,
            pk,
            key,
            val,
            meta,
            dirty,
            orig,
            attributes,
            properties,
            relationships;

        dirty = this.get('dirtyAttributes').concat();

        attributes = this.getAttributes();
        relationships = this.getRelationships();

        properties = this.getProperties(attributes.concat(relationships));

        pk = this.get('pk');

        for (p in properties) {

            meta = this.constructor.metaForProperty(p);

            if (skipDirty && ~dirty.indexOf(p)) {
                continue;
            }

            key = meta && meta.options ? meta.options.key || p : p;

            val = Ember.get(json, key);

            if (typeof val !== 'undefined') {
                val = val === null ? null : meta.deserialize.call(this, val, skipDirty);
                this.set(meta.key, val);
            }

        }

        if (this.primaryKey) {
            this.set('pk', json[this.primaryKey] || pk);
        }

        this.set('__isLoaded', true);

        if (skipDirty) {

            orig = {};

            for (i = 0; i < dirty.length; i ++) {
                p = dirty[i];
                orig[dirty[i]] = this.__originalData[p];
            }
        }

        else {
            dirty = [];
            orig = null;
        }

        this.__originalData = orig;
        this.set('dirtyAttributes', dirty);
    },

    validate : function () {
        return true;
    },

    merge : function (data, skipDirty) {

        var p,
            dirty;

        data = data || {};
        data = data instanceof DF.Model ? data.deserialize() : data;
        delete data[this.primaryKey];

        dirty = this.get('dirtyAttributes').concat();

        for (p in data) {
            if (!skipDirty || dirty.indexOf(p) < 0) {
                this.set(p, data[p]);
            }
        }
    },

    save : function () {
        return this.saveRecord();
    },

    fetch : function () {
        return this.fetchRecord();
    },

    fetchRecord : function () {

        this.set('__isLoaded', false);

        if (this.get('__isFetching')) {
            return this.__currentPromise;
        }

        this.set('__isFetching', true);

        return this.__currentPromise = this.adapter.fetch(this.constructor, this.get('pk')).then(function (json) {

            this.set('__isFetching', false);

            json = Ember.isArray(json) ? json[0] : json;
            json = json[this.typeKey] || json;

            this.deserialize(json);

        }.bind(this));
    },

    saveRecord : function () {

        if (this.get('isValid')) {

            this.set('dirtyAttributes', []);

            return this.adapter.saveRecord(this).then(function (json) {

                var isNew = this.get('isNew');

                json = Ember.isArray(json) ? json[0] : json;
                json = json[this.typeKey] || json;

                this.deserialize(json);
                this.set('__isLoaded', true);

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
        this.store.remove(this);

        return this.adapter.deleteRecord(this).then(function (json) {

            this.set('__isDeleting', false);
            this.set('__isDeleted', true);

            this.destroy();

        }.bind(this));
    },

    clone : function () {

        var copy;

        copy = this.constructor.create(this.serialize());
        copy.set('pk', null);

        copy.set('__isLoaded', true);
        copy.set('dirtyAttributes', []);

        return copy;
    },

    revert : function (revertRelationships) {

        var i,
            p,
            r,
            meta,
            relationships;

        this.merge(this.__originalData);

        relationships = this.getRelationships();

        for (i = 0; i < relationships.length; i ++) {
            p = relationships[i];
            meta = this.constructor.metaForProperty(p);

            if (meta.options && meta.options.embedded || revertRelationships) {

                r = this.get(p);

                if (meta.type === 'hasMany') {
                    meta.revert.call(this);
                }

                else {
                    r && r.revert(revertRelationships);
                }
            }
        }

        this.__originalData = null;

        this.set('dirtyAttributes', []);
    }
});

DF.Model.reopenClass({

    getAttributes : function () {

        var a,
            b,
            i;

        this.proto();
        a = this.__attributes || [];

        if (typeof this.superclass.getAttributes === 'function') {

            b = this.superclass.getAttributes();

            for (i = 0; i < b.length; i ++) {
                if (a.indexOf(b[i]) < 0) {
                    a.push(b[i]);
                }
            }
        }

        return a;
    },

    getRelationships : function () {

        var a,
            b,
            i;

        this.proto();
        a = this.__relationships || [];

        if (typeof this.superclass.getRelationships === 'function') {

            b = this.superclass.getRelationships();

            for (i = 0; i < b.length; i ++) {
                if (a.indexOf(b[i]) < 0) {
                    a.push(b[i]);
                }
            }
        }

        return a;
    },

    extend : function () {

        var i,
            r,
            d,
            p,
            meta,
            props,
            computed,
            dirtyChecks,
            classProps,
            relationships;

        d = {};
        r = this._super.apply(this, arguments);
        classProps = ['primaryKey', 'url', 'typeKey', 'collectionKey'];

        props = [].slice.apply(arguments, [-1])[0];

        for (i = 0; i < classProps.length; i ++) {

            p = props[classProps[i]];

            if (p) {
                d[classProps[i]] = p;
            }
        }

        r.reopenClass(d);

        relationships = r.getRelationships();
        dirtyChecks = ['hasDirtyAttributes'];

        for (i = 0; i < relationships.length; i ++) {
            p = relationships[i];
            meta = r.metaForProperty(p);

            if (meta.isRelationship && meta.options.embedded) {

                dirtyChecks.push(p + '.isDirty');

                if (meta.type === 'hasMany') {
                    dirtyChecks.push(p + '.@each.isDirty');
                }
            }
        }

        Ember.defineProperty(r.prototype, 'isDirty', Ember.computed.apply(null, dirtyChecks.concat(function () {

            var i,
                r,
                r3;

            for (i = 0; i < dirtyChecks.length; i ++) {

                r = this.get(dirtyChecks[i]);

                if (r) {

                    if (r.forEach) {

                        r.forEach(function (r2) {
                            if (r2 === true) {
                                r = true;
                            }
                        });
                    }

                    if (r === true) {
                        return true;
                    }

                }
            }

            return false;

        })).readOnly());

        return r;
    }
});
