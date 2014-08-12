DF.attr = function (type, options) {

    if (typeof type === 'object') {
        options = type;
        type = 'string';
    }

    type = type || 'string';

    options = options || {};

    var attr = Ember.computed(function (key, val) {

        var data,
            oldVal,
            isDirty,
            dirtyAttrs,
            dirtyIndex;

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

                if (typeof this.__originalData[key] === 'undefined') {
                    this.__originalData[key] = data[key];
                }

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

            if (val === null && typeof options.defaultValue !== 'undefined') {
                val = options.defaultValue;
            }

            return val;
        }
    });

    return attr;
};