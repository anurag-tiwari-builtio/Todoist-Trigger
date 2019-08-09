var httpService = require("./http-service")

module.exports = {

	name: "project_created",

	label: "Project Created",

	version: "v3",

	input: {
		type: "object",
		title: "Project Created",
		description: "Short description",
		properties: {
			event: {
				type: "string",
				enum: ["project_created"],
				scopes: ["data:read"],
				required_scopes: ["data:read"],
				isExecute: true

			},
			polling: {
				type: "boolean",
				default: true,
				options: {
					hidden: true
				}
			}
		}
	},

	output: {
		"project_created": {
			type: "object",
			properties: {

			}
		}
	},

	mock_data: {
		"event_type": "Project Created",
		"type": "Project",
		"id": 123456789,
		"name": "Welcome",
		"is_favorite": 0,
		"color": 7,
		"is_archived": 0,
		"is_deleted": 0,
		"url": "https://todoist.com/app#project/123456789",
		"parent_id": 12342344,
		"parent_name": "Parent",
		"indent": 1,
		"collapsed": 0,
		"item_order": 0,
		"shared": false
	},

	mock_input: {},

	makeProjectRequest: function (accessToken, syncToken) {
		const promiseArr = [
			httpService.getSyncData(accessToken, ["projects"], syncToken)
		]

		return Promise.all(promiseArr).then(body => {
			return new Promise((resolve, reject) => {
				if (
					body && body.length == promiseArr.length &&
					body[0].sync_token && body[0].projects
				) {
					resolve(body[0])
				} else if (!body || body.length != promiseArr.length) {
					reject("Invalid response from the client")
				} else if (!body[0].sync_token) {
					reject("No Authorization details from the client")
				} else if (!body[0].projects) {
					reject("No project details in the response sent by the client")
				} else {
					reject("Unknown error reported please contact customer support team")
				}
			})
		})
	},

	execute: function (input, options, output) {
		this.makeProjectRequest(input.auth.access_token, options.meta.syncToken)
			.then((body) => {
				let newProjects = this.filterNewProjects(body.projects, options.meta.projectIds)
				this.setOptions(options, body.sync_token, newProjects)
				return this.outputSchema(newProjects, input.auth.access_token)
			}).then(ret => {
				output(null, ret)
			}).catch((error) => {
				output(error)
			})
	},

	activate: function (input, options, output) {
		this.makeProjectRequest(input.auth.access_token, options.meta.syncToken)
			.then((body) => {
				let newProjects = this.filterNewProjects(body.projects, options.meta.projectIds)

				this.setOptions(options, body.sync_token, newProjects)

				output(null, "Activated")
			}).catch((error) => {
				output(error)
			})
	},

	validate: function (input, options, output) {
		this.makeProjectRequest(input.auth.access_token, options.meta.syncToken)
			.then((body) => {
				let newProjects = this.filterNewProjects(body.projects, options.meta.projectIds)

				this.setOptions(options, body.sync_token, newProjects)

				output(null, "Validated")
			}).catch((error) => {
				output(error)
			})
	},

	filterNewProjects: function (projects, existingProjects = []) {
		return projects.filter(project => existingProjects.indexOf(project.id) == -1)
	},

	setOptions: function (options, syncToken, newProjects) {
		let updatedProjectIds = (options.meta.projectIds || []).concat(
			(newProjects || []).map(project => project.id)
		)

		options.setMeta({
			syncToken: syncToken,
			projectIds: updatedProjectIds || [],
		})
	},

	outputSchema: function (projects, accessToken) {
		const isKeyPresent = (ret, project, key) => {
			ret[key] = project[key] || (project[key] === false ? false : (project[key] === 0 ? 0 : ""))
		}

		return projects && projects.length ? Promise.all(projects.map(project => {
			return new Promise(resolve => {
				let ret = {}
				resolve(ret)
			}).then(ret => {
				ret["event_type"] = "Project Created"
				ret["type"] = project.parent_id ? "Subproject" : "Project"
				isKeyPresent(ret, project, "id")
				isKeyPresent(ret, project, "name")
				isKeyPresent(ret, project, "is_favorite")
				isKeyPresent(ret, project, "color")
				isKeyPresent(ret, project, "is_archived")
				isKeyPresent(ret, project, "is_deleted")

				if (ret["id"]) {
					ret["url"] = "https://todoist.com/app#project/" + ret["id"]
				}

				isKeyPresent(ret, project, "parent_id")
				isKeyPresent(ret, project, "parent_name")

				if (project["parent_id"]) {
					return httpService.getRequest(accessToken, "projects", project["parent_id"])
						.then((body) => {
							ret["parent_name"] = body ? body.name : ""
							return ret
						}).catch(() => {
							return ret
						})

				} else {
					return ret
				}
			}).then(ret => {
				isKeyPresent(ret, project, "indent")
				isKeyPresent(ret, project, "collapsed")
				isKeyPresent(ret, project, "item_order")
				isKeyPresent(ret, project, "shared")

				return ret
			}).catch(error => {
				return {
					"promiseError": "Error occured for project -> " + project.id + "error -> " + error
				}
			})
		})) : []
	}
}