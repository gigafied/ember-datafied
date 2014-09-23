DF.belongsTo = function (factoryName, options) {

    var factory,
        belongsTo;

    options = options || {};

    belongsTo = Ember.computed(function (key, val) {

        var ckey,
            data,
            oldVal,
            isDirty,
            undefined,
            controller,
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

                if (typeof val === 'string' || typeof val === 'number') {
                    val = this.store.findInCacheOrCreate(factoryName, val);
                }

                if (val) {

                    while (val instanceof DF.ModelController) {
                        val = val.get('model');
                    }

                    Ember.assert(
                        Ember.String.fmt('Attempted to set property of type: %@ with a value of type: %@',
                        [factoryName, val.constructor]),
                        val instanceof factory
                    );
                }

                if (typeof this.__originalData[key] === 'undefined') {
                    this.__originalData[key] = data[key];
                }

                data[key] = val;
            }
        }

        else {
            val = data ? data[key] : undefined;
        }

        ckey = '__controller_' + key;

        if (!this.get(ckey) && typeof val !== 'undefined') {
            controller = this.store.controllerFor(factoryName);
            if (controller) {
                controller.set('model', val);
                this.set(ckey, controller);
                return controller;
            }
        }

        else if (typeof val !== 'undefined') {
            this.get(ckey).set('model', val);
            return this.get(ckey);
        }

        return val;

    }).property('__data');

    belongsTo.meta({

        type : 'belongsTo',
        isRelationship : true,
        options : options,
        factory : factory,

        serialize : function () {

            var val,
                data,
                meta,
                undefined;

            data = this.get('__data');
            meta = belongsTo.meta();
            val = data ? data[meta.key] : undefined;

            if (val) {

                if (options.embedded) {
                    return val.serialize();
                }

                return val.get('pk');
            }

            return val;
        },

        deserialize : function (val, skipDirty) {

            var meta,
                data,
                record;

            meta = belongsTo.meta();
            data = this.get('__data');

            if (options.embedded) {

                record = data && data[meta.key] || factory.create();

                if (val && typeof val === 'object') {
                    record.deserialize(val, skipDirty);
                }
            }

            else {
                record = this.store.findInCacheOrCreate(factoryName, val);
            }

            return record;
        }
    });

    return belongsTo;
};