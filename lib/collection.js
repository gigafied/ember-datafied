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