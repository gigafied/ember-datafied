(function () {

    function proxy (fn) {

        return function () {
            return this.get('model')[fn].apply(this.get('model'), arguments);
        };
    }

    DF.ModelController = Ember.ObjectController.extend({

        getAttributes : proxy('getAttributes'),
        getRelationships : proxy('getRelationships'),

        serialize : proxy('serialize'),
        deserialize : proxy('deserialize'),
        validate : proxy('validate'),
        merge : proxy('merge'),
        save : proxy('save'),
        fetch : proxy('fetch'),
        fetchRecord : proxy('fetchRecord'),
        saveRecord : proxy('saveRecord'),
        deleteRecord : proxy('deleteRecord'),
        clone : proxy('clone'),
        revert : proxy('revert')

    });

})();
