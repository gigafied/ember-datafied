DF.hasMany = function (factoryName, options) {

    var factory,
        hasMany;

    options = options || {};

    hasMany = Ember.computed(function (key, val) {

        var data,
            undef,
            oldVal,
            oldLen,
            isDirty,
            undefined,
            dirtyAttrs,
            dirtyIndex;

        factory = this.store.modelFor(factoryName);

        data = this.get('__data');

        if (arguments.length === 2) {

            if (!data) {
                data = {};
                this.set('__data', data);
            }

            oldVal = data[key];

            if (oldVal !== val) {

                if (!this.__originalData) {
                    this.__originalData = Ember.copy(data || {});
                    isDirty = true;
                }

                else {
                    isDirty = this.__originalData[key] !== val;
                }

                dirtyAttrs = this.get('dirtyAttributes');
                dirtyIndex = dirtyAttrs.indexOf(key);

                if (dirtyIndex < 0 && isDirty) {
                    dirtyAttrs.push(key);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                else if (!isDirty && dirtyIndex >= 0) {
                    dirtyAttrs.splice(dirtyIndex, 1);
                    this.set('dirtyAttributes', dirtyAttrs);
                    this.notifyPropertyChange('dirtyAttributes');
                }

                if (val) {

                    Ember.assert(
                        Ember.String.fmt('Attempted to set property of type: %@ with a value of type: %@',
                        [val.constructor, DF.Collection]),
                        val instanceof DF.Collection
                    );
                }

                if (typeof this.__originalData[key] === 'undefined') {
                    this.__originalData[key] = data[key];
                }

                data[key] = val;

                if (val) {

                    var oldLen = data[key] && data[key].get('content.length') || 0;

                    Ember.addObserver(val, 'length', this, function () {

                        dirtyAttrs = this.get('dirtyAttributes');
                        dirtyIndex = dirtyAttrs.indexOf(key + '.length');

                        if (val.get('length') !== oldLen) {

                            if (dirtyIndex < 0) {
                                dirtyAttrs.push(key + '.length');
                                this.set('dirtyAttributes', dirtyAttrs);
                                this.notifyPropertyChange('dirtyAttributes');
                            }
                        }

                        else {
                            dirtyAttrs.splice(dirtyIndex, 1);
                            this.set('dirtyAttributes', dirtyAttrs);
                            this.notifyPropertyChange('dirtyAttributes');
                        }
                    });
                }
            }
        }

        else {
            val = data ? data[key] : undefined;
        }

        return val;

    }).property('__data');

    hasMany.meta({

        type : 'hasMany',
        isRelationship : true,
        options : options,
        factory : factory,

        serialize : function () {

            var i,
                val,
                map,
                meta,
                val2,
                data,
                undefined;

            map = options.map || {};

            data = this.get('__data');
            meta = hasMany.meta();
            val = data ? data[meta.key] :  undefined;

            val = val ? val.serialize(options.embedded) : val;

            if (val && options.fromObject) {

                val2 = {};

                for (i = 0; i < val.length; i ++) {
                    val2[val[i][map.key]] = val[i][map.value] || val[i];
                }

                val = val2;
            }

            return val;
        },

        revert : function () {

            var data,
                meta,
                json;

            meta = hasMany.meta();
            data = this.get('__data');

            json = this.get('__' + meta.key + '_json');

            if (json) {
                meta.deserialize.call(this, json);
            }

        },

        deserialize : function (val, skipDirty) {

            var i,
                j,
                obj,
                obj2,
                map,
                val2,
                meta,
                data,
                record,
                record2,
                records,
                collection;

            meta = hasMany.meta();
            data = this.get('__data');

            map = options.map || {};

            if (skipDirty && options.embedded) {
                val2 = data && data[meta.key];

                if (val2) {
                    if (val2.get('isDirty')) {
                        return val2;
                    }
                }
            }

            if (!val) {
                val = [];
            }

            if (val && !Ember.isArray(val) && typeof val === 'object') {

                options.fromObject = true;
                val2 = [];

                for (i in val) {

                    if (val[i] && !Ember.isArray(val[i]) && typeof val[i] === 'object') {
                        obj = val[i];
                    }

                    else {
                        obj = {value : val[i]};
                    }

                    obj.key = i;
                    obj2 = {};

                    for (j in obj) {
                        obj2[map[j] || j] = obj[j];
                    }

                    val2.push(obj2);
                }

                val = val2;
            }

            val = Ember.isArray(val) ? val : [val];
            records = [];

            collection = data && data[meta.key] || DF.Collection.create({content : Ember.A()});

            if (options.embedded) {
                this.set('__' + meta.key + '_json', val);
            }

            for (i = 0; i < val.length; i ++) {

                if (val && val[i]) {

                    if (options.embedded && typeof val[i] === 'object') {

                        record = collection.get('content')[i];

                        if (!record) {
                            record = factory.create();
                            records.push(record);
                        }

                        record.deserialize(val[i]);
                    }

                    else {
                        record = this.store.findInCacheOrCreate(factoryName, val[i]);
                        record2 = collection.get('content')[i];

                        if (!record2) {
                            records.push(record);
                        }

                        else if (record !== record2) {
                            collection.replaceContent(i, 1, [record]);
                        }

                    }
                }
            }

            if (val.length < collection.get('length')) {
                collection.removeAt(val.length, collection.get('length') - val.length);
            }

            collection.set('factory', factory);
            collection.set('primaryKey', factory.primaryKey);
            collection.set('typeKey', factory.typeKey);
            collection.set('collectionKey', factory.collectionKey);

            if (records.length) {
                collection.pushObjects(records);
            }

            return collection;
        }
    });

    return hasMany;
};